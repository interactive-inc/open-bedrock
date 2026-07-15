import { AuthenticateEmployee } from "@/application/auth/authenticate-employee"
import { createAuditEvent } from "@/domain/audit/audit-event"
import { AuditEventRepository } from "@/infrastructure/audit/audit-event-repository"
import { hashAuditIdentifier } from "@/lib/audit/hash-identifier"
import { ApplicationError, UnavailableError } from "@/lib/errors"
import { factory } from "@/lib/factory"
import { zAppAuthToken } from "@/lib/app-schemas"
import { zValidator } from "@hono/zod-validator"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/interface/lib/errors"
import {
  checkAccountRateLimit,
  checkRateLimit,
  clearAccountFailures,
  recordAccountFailure,
  recordFailure,
} from "@/interface/shared/login-rate-limit"
import { z } from "zod"

let loginRateLimitWarned = false
function loginRateLimitWarn() {
  if (!loginRateLimitWarned) {
    loginRateLimitWarned = true
    console.warn("[SECURITY] Login rate limiting disabled: RATE_LIMIT KV binding not found")
  }
}

// POST /auth/login — メールとパスワードを照合しアクセストークンを発行する
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
    // 本番では wrangler.jsonc の kv_namespaces で RATE_LIMIT を必ずバインドすること。
    if (kv === undefined) {
      loginRateLimitWarn()
    }
    if (kv !== undefined) {
      const ipLimited = await checkRateLimit(kv, ip)

      if (ipLimited) {
        return c.json({ error: "too many requests" }, 429)
      }

      const accountLimited = await checkAccountRateLimit(kv, email)

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
      if (kv !== undefined) {
        await recordFailure(kv, ip)
        await recordAccountFailure(kv, email)
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
    if (kv !== undefined) {
      await clearAccountFailures(kv, email)
    }

    const responseBody = zAppAuthToken.parse({
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
    })

    return c.json(responseBody, 200)
  },
)
