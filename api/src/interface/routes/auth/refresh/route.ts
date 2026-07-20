import { RefreshAccessToken } from "@/application/auth/refresh-access-token"
import { ApplicationError } from "@/lib/errors"
import { factory } from "@/interface/utils/factory"
import { zAppAuthToken } from "@/lib/app-schemas"
import { zValidator } from "@hono/zod-validator"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/interface/lib/errors"
import { z } from "zod"

/** POST /auth/refresh — リフレッシュトークンで新しいアクセストークンを発行する */
export const POST = factory.createHandlers(
  zValidator(
    "json",
    z.object({
      refresh_token: z.string().max(200),
    }),
  ),
  async (c) => {
    const json = c.req.valid("json")
    const now = c.env.NOW === undefined ? new Date() : new Date(c.env.NOW)

    const result = await new RefreshAccessToken(c).run({
      refreshToken: json.refresh_token,
      jwtSecret: c.env.JWT_SECRET,
      userAgent: c.req.header("User-Agent") ?? null,
      now,
    })

    if (result instanceof ApplicationError) {
      throw toHttpException(result)
    }

    if ("reason" in result) {
      throw new UnauthorizedError("invalid or expired refresh token")
    }

    const responseBody = zAppAuthToken.parse({
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
    })

    return c.json(responseBody, 200)
  },
)
