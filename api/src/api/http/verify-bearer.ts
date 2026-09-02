import { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { HonoEnv } from "@/env"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { resolveLiveEmployeeAccess } from "@/api/http/employees/resolve-live-employee-access"
import { AccountEmployeeLinkReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/account-employee-link-read.adapter"
import { ResolveAccountEmployeeLink } from "@/contexts/company/lib/workforce/resolve-account-employee-link"
import type { SystemAccountId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { UnauthorizedError } from "@/lib/http/errors"
import { SystemD1AuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-authorization.adapter"
import { readBearerAuthorization } from "@system/interface/authorization/lib/bearer-authorization"
import { createMiddleware } from "hono/factory"
import { resolveBearerAccount } from "@/api/http/resolve-bearer-account"

/**
 * Bearer トークンを検証し、本人と権限を c.var.session に載せる。
 * 権限は JWT に載せず毎回 DB 解決する(改竄面の排除・即時失効)。
 * tokenVersion 不一致・account 非 active・employee retired は即 401。
 */
export const verifyBearer = createMiddleware<HonoEnv>(async (c, next) => {
  if (c.req.path === "/company/bootstrap") {
    await next()
    return
  }

  const now = new Date(c.env.NOW ?? Date.now())
  if (!Number.isSafeInteger(now.getTime())) {
    throw new UnauthorizedError("account authorization is unavailable")
  }

  const authorization = readBearerAuthorization(c.req.header("authorization"))
  if (authorization.kind !== "token") throw new UnauthorizedError("invalid token")

  const bearerAccount = await resolveBearerAccount({
    token: authorization.token,
    env: c.env,
    now,
  })
  if (bearerAccount.kind === "unavailable") {
    throw new UnauthorizedError("account authentication is unavailable")
  }
  if (bearerAccount.kind === "rejected") throw new UnauthorizedError(bearerAccount.reason)

  const accountAuthorization = await new SystemD1AuthorizationAdapter({
    env: { DB: c.env.DB },
  }).resolveForAccount({ accountId: bearerAccount.accountId, resource: null, at: now })
  if (accountAuthorization instanceof Error) {
    throw new UnauthorizedError("account authorization is unavailable")
  }
  if (accountAuthorization === null) throw new UnauthorizedError("invalid token")

  const account = await new ResolveAccountEmployeeLink(new AccountEmployeeLinkReadAdapter(c), {
    evaluate: async (candidate: SystemAccountId) => ({
      ok: true as const,
      eligible: candidate === restoreWorkforceId("system_account", bearerAccount.accountId),
    }),
  }).execute({
    kind: "by_account",
    accountId: restoreWorkforceId("system_account", bearerAccount.accountId),
  })
  if (account.kind === "unavailable" || account.kind === "invalid_link") {
    throw new UnauthorizedError("account authentication is unavailable")
  }
  if (account.kind !== "found") throw new UnauthorizedError("account not found")

  c.set("accountTokenVersion", bearerAccount.tokenVersion)
  c.set("scopedPermissions", accountAuthorization.scopedPermissionKeys)
  const access = await resolveLiveEmployeeAccess(c, account.link.employeeId)
  if (access === null || access instanceof Error) {
    throw new UnauthorizedError("employee is unavailable")
  }

  c.set(
    "session",
    new CompanySessionValue({
      accountId: bearerAccount.accountId,
      employeeId: account.link.employeeId,
      employmentStatus: access.status,
      permissions: accountAuthorization.permissionKeys,
      roleKeys: accountAuthorization.roleKeys.map((key) => key.replace(/^company:/, "")),
    }),
  )

  await next()
})
