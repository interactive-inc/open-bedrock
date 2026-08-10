import { assertJwtSecret } from "@/lib/auth/assert-jwt-secret"
import { Session } from "@/domain/company/iam/session"
import { getAccountSessionRejection } from "@/domain/system/auth/get-account-session-rejection"
import type { HonoEnv } from "@/env"
import { AccountAuthRepository } from "@/infrastructure/auth/account-auth-repository"
import { AccountEmployeeLinkRepository } from "@/infrastructure/employee/account-employee-link-repository"
import { accessTokenService } from "@/infrastructure/auth/jose-token-signer"
import { legacyTokenPayloadSchema } from "@/lib/auth/token-payload"
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

  assertJwtSecret(c.env.JWT_SECRET)

  const payload = await toVerifiedPayload(token, c.env.JWT_SECRET)

  if (payload instanceof Error) {
    throw new UnauthorizedError("invalid token")
  }

  const account = await new AccountEmployeeLinkRepository(c).findLinkedAccount(payload.accountId)

  if (account === null || account instanceof Error) {
    throw new UnauthorizedError("account not found")
  }

  const accountSessionRejection = getAccountSessionRejection({
    isAccountActive: account.status === "active",
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
