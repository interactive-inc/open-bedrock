import { AuthenticateEmployee } from "@/application/auth/authenticate-employee"
import { factory } from "@/lib/factory"
import { zValidator } from "@hono/zod-validator"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { checkRateLimit, clearFailures, recordFailure } from "@/interface/shared/login-rate-limit"
import { z } from "zod"

// POST /auth/login — メールとパスワードを照合しアクセストークンを発行する
export const POST = factory.createHandlers(
  zValidator(
    "json",
    z.object({
      email: z.string().max(254),
      password: z.string().max(200),
    }),
  ),
  async (c) => {
    const kv = c.env.RATE_LIMIT

    const ip =
      c.req.header("CF-Connecting-IP") ??
      c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ??
      "unknown"

    // KV が設定されている環境のみレート制限を適用する（ローカル dev 等はスキップ）。
    if (kv !== undefined) {
      const limited = await checkRateLimit(kv, ip)
      if (limited) {
        return c.json({ error: "too many requests" }, 429)
      }
    }

    const json = c.req.valid("json")

    const result = await new AuthenticateEmployee(c).run({
      email: json.email,
      password: json.password,
      jwtSecret: c.env.JWT_SECRET,
    })

    if (result instanceof Error) {
      // 内部エラーは失敗としてカウントしない（攻撃者がエラーで消耗できないようにする意図はないため
      // シンプルに記録対象外とする）。
      throw new InternalError("login failed")
    }

    if ("reason" in result) {
      // 認証失敗: カウンタを増やす
      if (kv !== undefined) {
        await recordFailure(kv, ip)
      }
      throw new UnauthorizedError("invalid email or password")
    }

    // 認証成功: カウンタをリセットする
    if (kv !== undefined) {
      await clearFailures(kv, ip)
    }

    const responseBody = {
      access_token: result.accessToken,
    }

    return c.json(responseBody, 200)
  },
)
