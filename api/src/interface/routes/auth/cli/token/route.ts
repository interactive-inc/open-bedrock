import { CliLoginCodeRepository } from "@/infrastructure/auth/cli-login-code-repository"
import { cliLoginCodeHash } from "@/lib/auth/cli-login-code-hash"
import { factory } from "@/interface/utils/factory"
import { UnauthorizedError } from "@/interface/lib/errors"
import { zAppAuthToken } from "@/lib/app-schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/**
 * POST /auth/cli/token — CLI（ネイティブアプリ）ログインの one-time code をアクセストークンに交換する。
 * code は GET /auth/cli/callback がループバックへ渡した値で、1 回きり・60 秒 TTL。
 * 消費に成功すれば /auth/login と同じ形（AccessTokenView）でトークンを返す。無効・期限切れは 401。
 */
export const POST = factory.createHandlers(
  zValidator("json", z.object({ code: z.string().min(1).max(200) })),
  async (c) => {
    const { code } = c.req.valid("json")

    const now = c.env.NOW === undefined ? new Date() : new Date(c.env.NOW)
    const nowEpoch = Math.floor(now.getTime() / 1_000)

    const codeHash = await cliLoginCodeHash(code)

    const consumed = await new CliLoginCodeRepository(c).consume(codeHash, nowEpoch)
    if (consumed instanceof Error) {
      return c.json({ error: "cli login is unavailable", code: "cli_login_code_unavailable" }, 503)
    }
    if (consumed === null) {
      throw new UnauthorizedError("invalid or expired code")
    }

    const responseBody = zAppAuthToken.parse({
      access_token: consumed.accessToken,
      refresh_token: consumed.refreshToken,
    })

    return c.json(responseBody, 200)
  },
)
