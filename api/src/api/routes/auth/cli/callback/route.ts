import { ResolveCliIdentity } from "@/contexts/company-compatibility/application/auth/resolve-cli-identity"
import { createAuditEvent } from "@/contexts/company-compatibility/application/audit/company-audit-event"
import type { HonoEnv } from "@/env"
import { AuditEventRepository } from "@/contexts/company-compatibility/infrastructure/company/audit/audit-event-repository"
import { CliLoginCodeRepository } from "@/contexts/system-compatibility/infrastructure/auth/cli-login-code-repository"
import { CliLoginStateRepository } from "@/contexts/system-compatibility/infrastructure/auth/cli-login-state-repository"
import { IdentityLoginJtiRepository } from "@/contexts/system-compatibility/infrastructure/auth/identity-login-jti-repository"
import { cliIdentityRedirectUri } from "@/lib/auth/cli-identity-redirect-uri"
import { exchangeIdentityCode } from "@/lib/auth/exchange-identity-code"
import { getIdentityVerificationKey } from "@/lib/auth/get-identity-verification-key"
import { loginCodeHash } from "@/lib/auth/login-code-hash"
import { ApplicationError } from "@/lib/errors"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { verifyIdentityToken } from "@/lib/auth/verify-identity-token"
import { zValidator } from "@hono/zod-validator"
import type { Context } from "hono"
import { z } from "zod"

/** one-time code の有効期限（秒）。CLI がループバックを受けてすぐ交換する前提の短命値。 */
const CODE_TTL_SECONDS = 60

const querySchema = z.object({
  code: z.string().min(1).max(512).optional(),
  state: z.string().min(1).max(512).optional(),
  error: z.string().min(1).max(200).optional(),
})

// @authorization public - 未認証で到達してよい
/**
 * GET /auth/cli/callback — 外部 identity provider（ブローカー）からの戻り先。
 * state を one-time 消費して CLI のループバックポートを特定し、以降のあらゆる失敗も
 * `http://127.0.0.1:<port>/callback?state=...&error=...` へ 302 で返す（CLI を待たせない）。
 * state 自体が検証できない場合のみ、返す先が無いため 401 を直接返す。
 *
 * ここでは identity 検証・自動プロビジョニング・拒否監査までを行い、セッション（access/refresh
 * トークン）は発行しない。one-time code には解決済みの account/employee の id だけを載せて
 * ループバックへ返し、実際のセッション発行は POST /auth/cli/token が code を消費した時点で行う。
 * トークンを平文で保存領域（cli_login_codes）に置かないための二段構え。
 */
export const GET = factory.createHandlers(zValidator("query", querySchema), async (c) => {
  const { code, state: brokerState, error: brokerError } = c.req.valid("query")

  const now = c.env.NOW === undefined ? new Date() : new Date(c.env.NOW)
  const nowEpoch = Math.floor(now.getTime() / 1_000)

  if (brokerState === undefined) {
    return c.json({ error: "missing state" }, 401)
  }

  const consumed = await new CliLoginStateRepository(c).consume(brokerState, nowEpoch)
  if (consumed instanceof Error) {
    return c.json({ error: "cli login is unavailable", code: "cli_login_state_unavailable" }, 503)
  }
  if (consumed === null) {
    return c.json({ error: "invalid or expired state" }, 401)
  }

  const loopback = (kind: "error" | "code", value: string): Response => {
    const url = new URL(`http://127.0.0.1:${consumed.port}/callback`)
    url.searchParams.set("state", consumed.cliState)
    url.searchParams.set(kind, value)
    return c.redirect(url.toString(), 302)
  }
  const loopbackError = (reasonCode: string): Response => loopback("error", reasonCode)

  /**
   * CLI ログインの拒否を監査に記録したうえでループバックへ返す。
   * 監査書き込み自体が失敗した場合は「監査に書けなければログインさせない」規約
   * （auth/identity/login の denyIdentityLogin と同じ）を守り、reasonCode ではなく
   * audit_unavailable でループバックへ返す（CLI を待たせないため 503 では止めない）。
   */
  const denyAndLoopback = async (reasonCode: string): Promise<Response> => {
    const audited = await denyCliLogin(c, now, reasonCode)
    return loopbackError(audited ? reasonCode : "audit_unavailable")
  }

  if (brokerError !== undefined) {
    return loopbackError(brokerError)
  }

  if (code === undefined) {
    return loopbackError("missing_code")
  }

  const issuer = c.env.IDENTITY_ISSUER
  const apiOrigin = c.env.API_ORIGIN
  const verificationKey = getIdentityVerificationKey(c.env)
  const redirectUri =
    apiOrigin === undefined
      ? new Error("API origin is not configured")
      : cliIdentityRedirectUri(apiOrigin)
  if (
    issuer === undefined ||
    issuer.length === 0 ||
    apiOrigin === undefined ||
    apiOrigin.length === 0 ||
    verificationKey instanceof Error ||
    redirectUri instanceof Error
  ) {
    return loopbackError("cli_login_not_configured")
  }

  const token = await exchangeIdentityCode({
    code,
    codeVerifier: consumed.codeVerifier,
    redirectUri,
    issuer,
  })
  if (token instanceof Error) {
    return denyAndLoopback("invalid_token")
  }

  const claims = await verifyIdentityToken({
    token,
    verificationKey,
    issuer,
    // ブローカーは callback URL の origin を aud に入れて発行する（パスは含まない）。
    audience: apiOrigin,
    now,
  })

  if ("reason" in claims) {
    return denyAndLoopback("invalid_token")
  }

  if (claims.email_verified !== true) {
    return denyAndLoopback("email_unverified")
  }

  // replay 対策: jti を使用済みとして原子的に記録する。二重使用は拒否する。
  const jtiRepository = new IdentityLoginJtiRepository(c)
  const marked = await jtiRepository.markUsed(claims.jti, claims.exp, nowEpoch)
  if (marked instanceof Error) {
    return c.json({ error: "cli login is unavailable", code: "audit_unavailable" }, 503)
  }
  if (marked === "replayed") {
    return denyAndLoopback("token_replayed")
  }

  const result = await new ResolveCliIdentity(c).run({
    subject: claims.sub,
    email: claims.email,
    name: claims.name,
    now,
  })

  if (result instanceof ApplicationError) {
    return loopbackError(result.code)
  }

  if ("reason" in result) {
    return denyAndLoopback(result.reason)
  }

  const rawCode = crypto.randomUUID()
  const codeHash = await loginCodeHash(rawCode)

  const codeCreated = await new CliLoginCodeRepository(c).create(
    codeHash,
    { accountId: result.accountId },
    nowEpoch + CODE_TTL_SECONDS,
  )
  if (codeCreated instanceof Error) {
    return c.json({ error: "cli login is unavailable", code: "cli_login_code_unavailable" }, 503)
  }

  return loopback("code", rawCode)
})

/**
 * CLI ログインの拒否を監査に記録する。書き込みに成功したら true、失敗したら false を返す。
 * 呼び出し側（denyAndLoopback）は false のとき reasonCode の代わりに audit_unavailable を
 * ループバックへ載せ、「監査に書けなければログインさせない」規約を守る。
 */
async function denyCliLogin(c: Context<HonoEnv>, now: Date, reasonCode: string): Promise<boolean> {
  try {
    const record = createAuditEvent(
      {
        actorAccountId: null,
        actorEmployeeId: null,
        action: "auth.session.cli_login_denied",
        target: { type: "session", id: null },
        outcome: "denied",
        reasonCode,
        now,
      },
      c.var.auditContext,
    )
    await new AuditEventRepository(c).append(record)
    return true
  } catch {
    return false
  }
}
