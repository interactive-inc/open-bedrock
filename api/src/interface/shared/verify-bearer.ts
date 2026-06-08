import { tokenPayloadSchema } from "@/domain/auth/token-payload"
import type { HonoEnv } from "@/env"
import { UnauthorizedError } from "@/interface/lib/errors"
import { createMiddleware } from "hono/factory"
import { jwtVerify } from "jose"

// Bearer トークンを検証し、本人を c.var.session に載せる。
export const verifyBearer = createMiddleware<HonoEnv>(async (c, next) => {
  const header = c.req.header("Authorization")

  if (!header || !header.startsWith("Bearer ")) {
    throw new UnauthorizedError("missing bearer token")
  }

  const token = header.slice("Bearer ".length)

  const payload = await toVerifiedPayload(token, c.env.JWT_SECRET)

  if (payload instanceof Error) {
    throw new UnauthorizedError("invalid token")
  }

  c.set("session", payload)

  await next()
})

async function toVerifiedPayload(token: string, jwtSecret: string) {
  try {
    // アルゴリズムを HS256 に固定する（アルゴリズム混同攻撃の防止）。
    // exp が付いていれば jwtVerify が期限切れを自動で弾く。
    const verified = await jwtVerify(token, new TextEncoder().encode(jwtSecret), {
      algorithms: ["HS256"],
    })

    const parsed = tokenPayloadSchema.safeParse(verified.payload)

    if (!parsed.success) {
      return new Error("token payload shape is invalid")
    }

    return parsed.data
  } catch (caught) {
    return caught instanceof Error ? caught : new Error("token verification failed")
  }
}
