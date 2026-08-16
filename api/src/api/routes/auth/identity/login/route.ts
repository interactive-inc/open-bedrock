import { AuthenticateIdentity } from "@/contexts/company/application/auth/authenticate-identity"
import { createAuditEvent } from "@/contexts/company/application/audit/company-audit-event"
import type { Context } from "@/env"
import { AuditEventRepository } from "@/contexts/company/infrastructure/company/audit/audit-event-repository"
import { IdentityLoginJtiRepository } from "@/api/legacy-system/adapters/auth/identity-login-jti-repository"
import { ApplicationError, UnavailableError } from "@/lib/errors"
import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyIdentityToken } from "@/lib/auth/verify-identity-token"
import { zAppAuthToken } from "@/lib/app-schemas"
import { zValidator } from "@hono/zod-validator"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { LoginRateLimiter } from "@/contexts/company/interface/utils/login-rate-limiter"
import { getIdentityVerificationKey } from "@/lib/auth/get-identity-verification-key"
import { z } from "zod"

const DEFAULT_AUDIENCE = "open-karte"

let identityLoginRateLimitWarned = false
function identityLoginRateLimitWarn() {
  if (!identityLoginRateLimitWarned) {
    identityLoginRateLimitWarned = true
    console.warn(
      "[SECURITY] Identity login rate limiting disabled: RATE_LIMIT KV binding not found",
    )
  }
}

// @authorization public - 未認証で到達してよい
/**
 * POST /auth/identity/login — 外部 identity provider の短命トークンでログインさせる。
 * 認証不要（トークン自体が資格情報）。署名・iss・aud・exp・email_verified・replay を検証し、
 * 事前同期済みアカウントにのみ access/refresh token を発行する（自動作成はしない）。
 */
export const POST = factory.createHandlers(
  zValidator("json", z.object({ token: z.string().min(1).max(4096) })),
  async (c) => {
    const kv = c.env.RATE_LIMIT
    const ip = c.req.header("CF-Connecting-IP") ?? "unknown-ip"

    if (kv === undefined) {
      identityLoginRateLimitWarn()
    }
    const limiter = kv === undefined ? null : new LoginRateLimiter(kv)

    if (limiter !== null && (await limiter.isIpLimited(ip))) {
      return c.json({ error: "too many requests" }, 429)
    }

    const issuer = c.env.IDENTITY_ISSUER
    const verificationKey = getIdentityVerificationKey(c.env)
    if (issuer === undefined || issuer.length === 0 || verificationKey instanceof Error) {
      // 設定不備は identity ログインを一律拒否する（安全側）。
      throw new UnauthorizedError("identity login is not configured")
    }
    const audience = c.env.IDENTITY_AUDIENCE ?? DEFAULT_AUDIENCE

    const now = c.env.NOW === undefined ? new Date() : new Date(c.env.NOW)

    const { token } = c.req.valid("json")

    const claims = await verifyIdentityToken({ token, verificationKey, issuer, audience, now })

    if ("reason" in claims) {
      return denyIdentityLogin(c, limiter, ip, now, "invalid_token")
    }

    if (claims.email_verified !== true) {
      return denyIdentityLogin(c, limiter, ip, now, "email_unverified")
    }

    // replay 対策: jti を使用済みとして原子的に記録する。二重使用は拒否する。
    const jtiRepository = new IdentityLoginJtiRepository(c)
    const marked = await jtiRepository.markUsed(
      claims.jti,
      claims.exp,
      Math.floor(now.getTime() / 1_000),
    )
    if (marked instanceof Error) {
      throw toHttpException(
        new UnavailableError("identity login is unavailable", "audit_unavailable", {
          cause: marked,
        }),
      )
    }
    if (marked === "replayed") {
      return denyIdentityLogin(c, limiter, ip, now, "token_replayed")
    }

    const result = await new AuthenticateIdentity(c).run({
      subject: claims.sub,
      jwtSecret: c.env.JWT_SECRET,
      userAgent: c.req.header("User-Agent") ?? null,
      now,
    })

    if (result instanceof ApplicationError) {
      // account_not_found（NotFoundError → 404）などはそのまま翻訳して返す。
      throw toHttpException(result)
    }

    if ("reason" in result) {
      return denyIdentityLogin(c, limiter, ip, now, "account_inactive")
    }

    const responseBody = zAppAuthToken.parse({
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
    })

    return c.json(responseBody, 200)
  },
)

/**
 * identity ログインの拒否を記録し、401 を返す。IP レート制限にも失敗を計上する。
 * 監査書き込みに失敗した場合は 503（audit_unavailable）へ倒す。
 */
async function denyIdentityLogin(
  c: Context,
  limiter: LoginRateLimiter | null,
  ip: string,
  now: Date,
  reasonCode: string,
): Promise<Response> {
  if (limiter !== null) {
    await limiter.recordIpFailure(ip)
  }

  try {
    const record = createAuditEvent(
      {
        actorAccountId: null,
        actorEmployeeId: null,
        action: "auth.session.identity_login_denied",
        target: { type: "session", id: null },
        outcome: "denied",
        reasonCode,
        now,
      },
      c.var.auditContext,
    )
    await new AuditEventRepository(c).append(record)
  } catch (cause) {
    throw toHttpException(
      new UnavailableError("identity login is unavailable", "audit_unavailable", { cause }),
    )
  }

  throw new UnauthorizedError("identity login denied")
}
