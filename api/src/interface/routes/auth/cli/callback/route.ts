import { AuthenticateCliIdentity } from "@/application/auth/authenticate-cli-identity"
import { createAuditEvent } from "@/domain/audit/audit-event"
import type { HonoEnv } from "@/env"
import { AuditEventRepository } from "@/infrastructure/audit/audit-event-repository"
import { CliLoginCodeRepository } from "@/infrastructure/auth/cli-login-code-repository"
import { CliLoginStateRepository } from "@/infrastructure/auth/cli-login-state-repository"
import { IdentityLoginJtiRepository } from "@/infrastructure/auth/identity-login-jti-repository"
import { cliLoginCodeHash } from "@/lib/auth/cli-login-code-hash"
import { ApplicationError } from "@/lib/errors"
import { factory } from "@/interface/utils/factory"
import { verifyIdentityToken } from "@/lib/auth/verify-identity-token"
import { zValidator } from "@hono/zod-validator"
import type { Context } from "hono"
import { z } from "zod"

/** one-time code の有効期限（秒）。CLI がループバックを受けてすぐ交換する前提の短命値。 */
const CODE_TTL_SECONDS = 60

const querySchema = z.object({
  token: z.string().min(1).max(4096).optional(),
  state: z.string().min(1).max(512).optional(),
  error: z.string().min(1).max(200).optional(),
})

/**
 * GET /auth/cli/callback — 外部 identity provider（ブローカー）からの戻り先。
 * state を one-time 消費して CLI のループバックポートを特定し、以降のあらゆる失敗も
 * `http://127.0.0.1:<port>/callback?state=...&error=...` へ 302 で返す（CLI を待たせない）。
 * state 自体が検証できない場合のみ、返す先が無いため 401 を直接返す。
 */
export const GET = factory.createHandlers(zValidator("query", querySchema), async (c) => {
  const { token, state: brokerState, error: brokerError } = c.req.valid("query")

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

  if (token === undefined) {
    return loopbackError("missing_token")
  }

  const secret = c.env.IDENTITY_JWT_SECRET
  const issuer = c.env.IDENTITY_ISSUER
  const apiOrigin = c.env.API_ORIGIN
  if (
    secret === undefined ||
    secret.length === 0 ||
    issuer === undefined ||
    issuer.length === 0 ||
    apiOrigin === undefined ||
    apiOrigin.length === 0
  ) {
    return loopbackError("cli_login_not_configured")
  }

  const claims = await verifyIdentityToken({
    token,
    secret,
    issuer,
    // callback URL の origin を audience として検証する（ブローカーはこの callback 宛にトークンを発行する）。
    audience: `${apiOrigin}/auth/cli/callback`,
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

  const result = await new AuthenticateCliIdentity(c).run({
    subject: claims.sub,
    email: claims.email,
    name: claims.name,
    jwtSecret: c.env.JWT_SECRET,
    userAgent: c.req.header("User-Agent") ?? null,
    now,
  })

  if (result instanceof ApplicationError) {
    return loopbackError(result.code)
  }

  if ("reason" in result) {
    return denyAndLoopback(result.reason)
  }

  if (result.refreshToken === null) {
    return c.json({ error: "cli login is unavailable", code: "unexpected" }, 503)
  }

  const rawCode = crypto.randomUUID()
  const codeHash = await cliLoginCodeHash(rawCode)

  const codeCreated = await new CliLoginCodeRepository(c).create(
    codeHash,
    { accessToken: result.accessToken, refreshToken: result.refreshToken },
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
