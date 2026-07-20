import { tokenPayloadSchema } from "@/lib/auth/token-payload"
import type { HonoEnv } from "@/env"
import { AccountAuthRepository } from "@/infrastructure/auth/account-auth-repository"
import { resolveLiveEmployeeAccess } from "@/application/auth/resolve-live-employee-access"
import { UnauthorizedError } from "@/interface/lib/errors"
import { createMiddleware } from "hono/factory"
import { jwtVerify } from "jose"

/**
 * Bearer トークンを検証し、本人と権限を c.var.session に載せる。
 * 権限は JWT に載せず毎回 DB 解決する(改竄面の排除・即時失効)。
 * tokenVersion 不一致・account 非 active・employee retired は即 401。
 */
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

  const accountRepository = new AccountAuthRepository(c)

  const account = await accountRepository.resolveById(payload.accountId)

  if (account === null || account instanceof Error) {
    throw new UnauthorizedError("account not found")
  }

  // 停止・ロックされたアカウントの既存トークンを即時無効化する。
  if (account.status !== "active") {
    throw new UnauthorizedError("account is not active")
  }

  // パスワード変更・ロール剥奪・停止で ++ される tokenVersion との不一致は即時失効。
  if (account.tokenVersion !== payload.tokenVersion) {
    throw new UnauthorizedError("token has been revoked")
  }

  if (account.employeeId === null) {
    throw new UnauthorizedError("account has no employee")
  }

  const access = await resolveLiveEmployeeAccess(c, account.employeeId)
  if (access === null || access instanceof Error)
    throw new UnauthorizedError("employee is unavailable")

  c.set("session", {
    accountId: account.accountId,
    employeeId: account.employeeId,
    employeeStatus: access.status,
    permissions: account.permissions,
    roleKeys: account.roleKeys,
  })

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
