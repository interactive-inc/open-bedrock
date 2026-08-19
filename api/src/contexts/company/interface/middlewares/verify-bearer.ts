import { Session } from "@/contexts/company/domain/iam/session"
import type { HonoEnv } from "@/env"
import { AccountEmployeeLinkRepository } from "@/contexts/company/infrastructure/employee/account-employee-link-repository"
import { resolveLiveEmployeeAccess } from "@/contexts/company/application/auth/resolve-live-employee-access"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { SystemAccessTokenAuthenticator } from "@system/interface/runtime/system-access-token-authenticator"
import { createMiddleware } from "hono/factory"

/**
 * Bearer トークンを検証し、本人と権限を c.var.session に載せる。
 * 権限は JWT に載せず毎回 DB 解決する(改竄面の排除・即時失効)。
 * tokenVersion 不一致・account 非 active・employee retired は即 401。
 */
export const verifyBearer = createMiddleware<HonoEnv>(async (c, next) => {
  const header = c.req.header("Authorization")
  const authentication = await new SystemAccessTokenAuthenticator({
    database: c.env.DB,
  }).authenticate(header, c.env.JWT_SECRET, new Date(c.env.NOW ?? Date.now()))

  if (authentication.kind === "unavailable") {
    throw new UnauthorizedError(
      authentication.reason === "authorization"
        ? "account authorization is unavailable"
        : "account authentication is unavailable",
    )
  }

  if (authentication.kind === "rejected") {
    if (authentication.reason === "account_not_found") {
      throw new UnauthorizedError("account not found")
    }
    if (authentication.reason === "account_inactive") {
      throw new UnauthorizedError("account is not active")
    }
    if (authentication.reason === "token_version_mismatch") {
      throw new UnauthorizedError("token has been revoked")
    }

    throw new UnauthorizedError("invalid token")
  }

  const account = await new AccountEmployeeLinkRepository(c).findLinkedAccount(
    authentication.accountId,
  )

  if (account instanceof Error) {
    throw new UnauthorizedError("account authentication is unavailable")
  }

  if (account === null) {
    throw new UnauthorizedError("account not found")
  }

  c.set("accountTokenVersion", authentication.tokenVersion)

  const access = await resolveLiveEmployeeAccess(c, account.employeeId)
  if (access === null || access instanceof Error)
    throw new UnauthorizedError("employee is unavailable")

  c.set(
    "session",
    new Session({
      accountId: account.accountId,
      employeeId: account.employeeId,
      employeeStatus: access.status,
      permissions: authentication.permissionKeys,
      roleKeys: authentication.roleKeys.map((key) => key.replace(/^company:/, "")),
    }),
  )

  await next()
})
