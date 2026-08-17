import { assertJwtSecret } from "@/lib/auth/assert-jwt-secret"
import { Session } from "@/contexts/company-compatibility/domain/iam/session"
import { resolveAccountSession } from "@system/application/auth/resolve-account-session"
import { getAccountSessionRejection } from "@/contexts/system/domain/auth/get-account-session-rejection"
import { parseBearerAuthorization } from "@/contexts/system/domain/auth/parse-bearer-authorization"
import { zAccountId } from "@system/domain/auth/account-id"
import type { HonoEnv } from "@/env"
import { AccountAuthRepository } from "@/api/legacy-system/adapters/auth/account-auth-repository"
import { AccountEmployeeLinkRepository } from "@/contexts/company-compatibility/infrastructure/employee/account-employee-link-repository"
import { SystemAccountRepository } from "@system/infrastructure/auth/system-account-repository"
import { accessTokenService } from "@/contexts/company-compatibility/infrastructure/auth/jose-token-signer"
import { legacyTokenPayloadSchema } from "@/lib/auth/token-payload"
import { resolveLiveEmployeeAccess } from "@/contexts/company-compatibility/application/auth/resolve-live-employee-access"
import { UnauthorizedError } from "@/contexts/company-compatibility/interface/lib/errors"
import { createMiddleware } from "hono/factory"
import { jwtVerify } from "jose"

/**
 * Bearer トークンを検証し、本人と権限を c.var.session に載せる。
 * 権限は JWT に載せず毎回 DB 解決する(改竄面の排除・即時失効)。
 * tokenVersion 不一致・account 非 active・employee retired は即 401。
 */
export const verifyBearer = createMiddleware<HonoEnv>(async (c, next) => {
  const header = c.req.header("Authorization")
  const bearerAuthorization = parseBearerAuthorization(header)

  if (bearerAuthorization.kind !== "token") {
    throw new UnauthorizedError("missing bearer token")
  }

  assertJwtSecret(c.env.JWT_SECRET)

  const payload = await toVerifiedPayload(bearerAuthorization.token, c.env.JWT_SECRET)

  if (payload instanceof Error) {
    throw new UnauthorizedError("invalid token")
  }

  const canonicalAccountId = zAccountId.safeParse(String(payload.accountId))

  if (canonicalAccountId.success === false) {
    throw new UnauthorizedError("invalid token")
  }

  const accountPromise = new AccountEmployeeLinkRepository(c).findLinkedAccount(payload.accountId)
  const canonicalSessionPromise = resolveAccountSession({
    accountRepository: new SystemAccountRepository({ database: c.env.DB }),
    accountId: canonicalAccountId.data,
    sessionTokenVersion: payload.tokenVersion,
  })
  const account = await accountPromise
  const canonicalSession = await canonicalSessionPromise

  if (account === null || account instanceof Error) {
    throw new UnauthorizedError("account not found")
  }

  if (canonicalSession instanceof Error) {
    throw new UnauthorizedError("account authentication is unavailable")
  }

  if (canonicalSession.kind === "rejected") {
    if (canonicalSession.reason === "account_not_found") {
      throw new UnauthorizedError("account not found")
    }

    if (canonicalSession.reason === "account_inactive") {
      throw new UnauthorizedError("account is not active")
    }

    throw new UnauthorizedError("token has been revoked")
  }

  const accountSessionRejection = getAccountSessionRejection({
    accountStatus: account.status,
    accountTokenVersion: account.tokenVersion,
    sessionTokenVersion: payload.tokenVersion,
  })

  // 停止・ロックされたアカウントの既存トークンを即時無効化する。
  if (accountSessionRejection === "account_inactive") {
    throw new UnauthorizedError("account is not active")
  }

  // パスワード変更・ロール剥奪・停止で ++ される tokenVersion との不一致は即時失効。
  if (accountSessionRejection !== null) {
    throw new UnauthorizedError("token has been revoked")
  }

  if (account.employeeId === null) {
    throw new UnauthorizedError("account has no employee")
  }

  const authorization = await new AccountAuthRepository(c).resolveAuthorizationById(
    account.accountId,
  )
  if (authorization instanceof Error) {
    throw new UnauthorizedError("account authorization is unavailable")
  }

  const access = await resolveLiveEmployeeAccess(c, account.employeeId)
  if (access === null || access instanceof Error)
    throw new UnauthorizedError("employee is unavailable")

  c.set(
    "session",
    new Session({
      accountId: account.accountId,
      employeeId: account.employeeId,
      employeeStatus: access.status,
      permissions: authorization.permissions,
      roleKeys: authorization.roleKeys,
    }),
  )

  await next()
})

async function toVerifiedPayload(token: string, jwtSecret: string) {
  try {
    const claims = await accessTokenService.verify(token, jwtSecret)
    const accountId = Number(claims.sub)

    if (!Number.isSafeInteger(accountId) || accountId <= 0) {
      return new Error("token subject is invalid")
    }

    return { accountId, tokenVersion: claims.ver }
  } catch {
    return toLegacyVerifiedPayload(token, jwtSecret)
  }
}

async function toLegacyVerifiedPayload(token: string, jwtSecret: string) {
  try {
    const verified = await jwtVerify(token, new TextEncoder().encode(jwtSecret), {
      algorithms: ["HS256"],
    })

    if (verified.protectedHeader.typ !== undefined) {
      return new Error("token type is invalid")
    }

    const legacy = legacyTokenPayloadSchema.safeParse(verified.payload)

    return legacy.success
      ? { accountId: legacy.data.accountId, tokenVersion: legacy.data.tokenVersion }
      : new Error("legacy token payload shape is invalid")
  } catch (caught) {
    return caught instanceof Error ? caught : new Error("token verification failed")
  }
}
