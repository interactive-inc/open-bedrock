import { AuthenticateEmployee } from "@/application/auth/authenticate-employee"
import { factory } from "@/lib/factory"
import { zValidator } from "@hono/zod-validator"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"
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
    const json = c.req.valid("json")

    const result = await new AuthenticateEmployee(c).run({
      email: json.email,
      password: json.password,
      jwtSecret: c.env.JWT_SECRET,
    })

    if (result instanceof Error) {
      throw new InternalError("login failed")
    }

    if ("reason" in result) {
      throw new UnauthorizedError("invalid email or password")
    }

    const responseBody = {
      access_token: result.accessToken,
    }

    return c.json(responseBody, 200)
  },
)
