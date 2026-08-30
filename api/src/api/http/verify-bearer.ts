import { Session } from "@/lib/auth/session"
import type { HonoEnv } from "@/env"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { resolveLiveEmployeeAccess } from "@/api/http/employees/resolve-live-employee-access"
import { AccountEmployeeLinkReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/account-employee-link-read.adapter"
import { ResolveAccountEmployeeLink } from "@/contexts/company/lib/workforce/resolve-account-employee-link"
import type { SystemAccountId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { UnauthorizedError } from "@/lib/http/errors"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAccessTokenSecretValue } from "@system/domain/values/auth/system-access-token-secret.value"
import { AccessTokenService } from "@system/lib/auth/access-token-service"
import { SYSTEM_ACCESS_TOKEN_PROFILE } from "@system/lib/auth/system-access-token-profile"
import { SystemAccountRepository } from "@system/infrastructure/repositories/auth/system-account.repository"
import { SystemD1AuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-authorization.adapter"
import { readBearerAuthorization } from "@system/interface/authorization/lib/bearer-authorization"
import { createMiddleware } from "hono/factory"

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

  const accessTokenSecret = SystemAccessTokenSecretValue.create(c.env.JWT_SECRET ?? "")
  if (!(accessTokenSecret instanceof SystemAccessTokenSecretValue)) {
    throw new UnauthorizedError("account authentication is unavailable")
  }

  const claims = await new AccessTokenService({ profile: SYSTEM_ACCESS_TOKEN_PROFILE }).verify(
    authorization.token,
    accessTokenSecret.toString(),
    new Date(),
  )
  if (claims instanceof Error) throw new UnauthorizedError("invalid token")

  const accountId = zAccountId.safeParse(claims.sub)
  if (!accountId.success) throw new UnauthorizedError("invalid token")

  const authentication = await SystemAccountRepository.resolveSession({
    accountRepository: new SystemAccountRepository({ database: c.env.DB }),
    accountId: accountId.data,
    sessionTokenVersion: claims.ver,
  })
  if (authentication instanceof Error) {
    throw new UnauthorizedError("account authentication is unavailable")
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

  const accountAuthorization = await new SystemD1AuthorizationAdapter({
    env: { DB: c.env.DB },
  }).resolveForAccount({ accountId: accountId.data, resource: null, at: now })
  if (accountAuthorization instanceof Error) {
    throw new UnauthorizedError("account authorization is unavailable")
  }
  if (accountAuthorization === null) throw new UnauthorizedError("invalid token")

  const account = await new ResolveAccountEmployeeLink(new AccountEmployeeLinkReadAdapter(c), {
    evaluate: async (candidate: SystemAccountId) => ({
      ok: true as const,
      eligible: candidate === restoreWorkforceId("system_account", accountId.data),
    }),
  }).execute({
    kind: "by_account",
    accountId: restoreWorkforceId("system_account", accountId.data),
  })
  if (account.kind === "unavailable" || account.kind === "invalid_link") {
    throw new UnauthorizedError("account authentication is unavailable")
  }
  if (account.kind !== "found") throw new UnauthorizedError("account not found")

  c.set("accountTokenVersion", authentication.account.tokenVersion)
  const access = await resolveLiveEmployeeAccess(c, account.link.employeeId)
  if (access === null || access instanceof Error) {
    throw new UnauthorizedError("employee is unavailable")
  }

  c.set(
    "session",
    new Session({
      accountId: accountId.data,
      employeeId: account.link.employeeId,
      employmentStatus: access.status,
      permissions: accountAuthorization.permissionKeys,
      roleKeys: accountAuthorization.roleKeys.map((key) => key.replace(/^company:/, "")),
    }),
  )

  await next()
})
