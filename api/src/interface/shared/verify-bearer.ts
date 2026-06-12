import { tokenPayloadSchema } from "@/domain/auth/token-payload"
import type { HonoEnv } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { UnauthorizedError } from "@/interface/lib/errors"
import { createMiddleware } from "hono/factory"
import { jwtVerify } from "jose"

// Bearer トークンを検証し、本人を c.var.session に載せる。
// JWT の role は発行時点のスナップショットなので、DB から最新 role を再取得して上書きする。
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

  const repo = new EmployeeRepository(c)
  const employee = await repo.findById(payload.employeeId)

  if (employee === null || employee instanceof Error) {
    throw new UnauthorizedError("employee not found")
  }

  // 退職者の既存トークンを即時無効化する。
  if (employee.status === "retired") {
    throw new UnauthorizedError("employee is retired")
  }

  c.set("session", { ...payload, role: employee.role })

  await next()
})

async function toVerifiedPayload(token: string, jwtSecret: string) {
  try {
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
