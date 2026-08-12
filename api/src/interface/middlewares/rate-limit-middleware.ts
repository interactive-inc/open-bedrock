import type { HonoEnv } from "@/env"
import { isProductionEnvironment } from "@/lib/config/is-production-environment"
import { createMiddleware } from "hono/factory"

let rateLimitWarningLogged = false

/**
 * IP 単位のグローバルレート制限。Cloudflare Workers の Rate Limiting binding を使う。
 * binding 未設定はローカル開発・テストではスキップ、本番相当（CORS_ORIGIN 設定済み）では
 * fail-open にせず 503 で拒否する（設定漏れをブルートフォース可能な状態で放置しない）。
 * /health は監視・ヘルスチェック用途のため対象外。ログインは別途アカウント単位の
 * レート制限を持つが、ここでの IP 単位制限も併せてかかる。
 */
export const rateLimitMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  const limiter = c.env.API_RATE_LIMITER

  if (c.req.path === "/health") {
    await next()

    return
  }

  if (limiter === undefined) {
    if (isProductionEnvironment(c.env)) {
      console.error("[SECURITY] API_RATE_LIMITER binding is missing in production — failing closed")

      return c.json({ error: "rate limiter is not configured" }, 503)
    }

    if (!rateLimitWarningLogged) {
      rateLimitWarningLogged = true
      console.warn("[SECURITY] Rate limiting disabled: API_RATE_LIMITER binding not found")
    }
    await next()

    return
  }

  // Prefer CF-Connecting-IP (trusted, set by Cloudflare). When absent (non-CF
  // requests), use a fixed key so all non-CF traffic shares one global bucket
  // instead of trusting the spoofable X-Forwarded-For header.
  const ip = c.req.header("CF-Connecting-IP") ?? "unknown-ip"

  const outcome = await limiter.limit({ key: ip })

  if (outcome.success === false) {
    return c.json({ error: "too many requests" }, 429)
  }

  await next()
})
