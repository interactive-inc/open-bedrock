import { AuthenticateEmployee } from "@/contexts/company/application/auth/authenticate-employee"
import { createAuditEvent } from "@/composition/audit/audit-event"
import { AuditEventRepository } from "@/contexts/company/infrastructure/company/audit/audit-event-repository"
import { hashAuditIdentifier } from "@/lib/audit/hash-audit-identifier"
import { ApplicationError, UnavailableError } from "@/lib/errors"
import { factory } from "@/contexts/company/interface/utils/factory"
import { zAppAuthToken } from "@/lib/app-schemas"
import { zValidator } from "@hono/zod-validator"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { LoginRateLimiter } from "@/contexts/company/interface/utils/login-rate-limiter"
import { isProductionEnvironment } from "@/lib/config/is-production-environment"
import { z } from "zod"

let loginRateLimitWarned = false
function loginRateLimitWarn() {
  if (!loginRateLimitWarned) {
    loginRateLimitWarned = true
    console.warn("[SECURITY] Login rate limiting disabled: RATE_LIMIT KV binding not found")
  }
}

// @authorization public - 未認証で到達してよい
/** POST /auth/login — メールとパスワードを照合しアクセストークンを発行する */
export const POST = factory.createHandlers(
  zValidator(
    "json",
    z.object({
      email: z.string().max(254),
      password: z.string().min(1).max(200),
    }),
  ),
  async (c) => {
    const kv = c.env.RATE_LIMIT

    const ip = c.req.header("CF-Connecting-IP") ?? "unknown-ip"

    const json = c.req.valid("json")
    const email = json.email

    // KV が設定されている環境のみレート制限を適用する（ローカル dev 等はスキップ）。
    // 本番相当（CORS_ORIGIN 設定済み）では fail-open にせず 503 で拒否する。
    if (kv === undefined && isProductionEnvironment(c.env)) {
      console.error("[SECURITY] RATE_LIMIT KV binding is missing in production — failing closed")

      return c.json({ error: "rate limiter is not configured" }, 503)
    }

    if (kv === undefined) {
      loginRateLimitWarn()
    }
    const limiter = kv === undefined ? null : new LoginRateLimiter(kv)

    if (limiter !== null) {
      const ipLimited = await limiter.isIpLimited(ip)

      if (ipLimited) {
        return c.json({ error: "too many requests" }, 429)
      }

      const accountLimited = await limiter.isAccountLimited(email)

      if (accountLimited) {
        return c.json({ error: "too many requests" }, 429)
      }
    }

    const now = c.env.NOW === undefined ? new Date() : new Date(c.env.NOW)

    const result = await new AuthenticateEmployee(c).run({
      email,
      password: json.password,
      jwtSecret: c.env.JWT_SECRET,
      userAgent: c.req.header("User-Agent") ?? null,
      now,
    })

    if (result instanceof ApplicationError) {
      // 内部エラーは失敗としてカウントしない（攻撃者がエラーで消耗できないようにする意図はないため
      // シンプルに記録対象外とする）。
      throw toHttpException(result)
    }

    if ("reason" in result) {
      // 認証失敗: IP・アカウント両方のカウンタを増やす
      if (limiter !== null) {
        await limiter.recordIpFailure(ip)
        await limiter.recordAccountFailure(email)
      }

      try {
        const identifierHash = await hashAuditIdentifier(email, c.env.AUDIT_HMAC_SECRET)
        const record = createAuditEvent(
          {
            actorAccountId: null,
            actorEmployeeId: null,
            action: "auth.session.login_denied",
            target: { type: "session", id: null },
            outcome: "denied",
            reasonCode: "invalid_credentials",
            metadata: { identifier_hash: identifierHash },
            now,
          },
          c.var.auditContext,
        )
        await new AuditEventRepository(c).append(record)
      } catch (cause) {
        throw toHttpException(
          new UnavailableError("invalid email or password", "audit_unavailable", { cause }),
        )
      }

      throw new UnauthorizedError("invalid email or password")
    }

    // 認証成功: アカウントカウンタのみリセットする。
    // IP カウンタは TTL で自然消滅させる（共有 IP 環境で攻撃者のカウンタまで
    // リセットされるのを防ぐ）。
    if (limiter !== null) {
      await limiter.clearAccountFailures(email)
    }

    const responseBody = zAppAuthToken.parse({
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
    })

    return c.json(responseBody, 200)
  },
)
