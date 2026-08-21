import {
  SYSTEM_ACCESS_TOKEN_AUDIENCE,
  SYSTEM_ACCESS_TOKEN_ISSUER,
} from "@system/infrastructure/auth/system-access-token-profile.repository"
import { SystemAccessTokenIssuer } from "@system/infrastructure/auth/system-access-token-issuer.repository"
import { ACCESS_TOKEN_TYPE } from "@system/domain/values/access-token-claims.schema"
import { zAccountId } from "@system/domain/values/account-id.schema"
import { SignJWT } from "jose"

/**
 * テスト用トークンの入力。後方互換のため email/role も受け付けるが署名には載せない。
 * accountId 省略時は employeeId を流用(テストは account.id=employee.id で seed する)、
 * tokenVersion 省略時は 0(seed の既定値)。
 */
export type TestTokenPayload = {
  employeeId: number
  accountId?: number | string
  tokenVersion?: number
  email?: string
  role?: string
}

/**
 * 通常は本番と同じ access token profile で署名する。expirationTime を指定するテストだけは
 * 有効期限を上書きした token を作る。
 */
export async function createTestToken(
  secret: string,
  payload: TestTokenPayload,
  options?: { expirationTime?: string | number },
): Promise<string> {
  if (options?.expirationTime === undefined) {
    const token = await new SystemAccessTokenIssuer(secret).issue({
      accountId: zAccountId.parse(String(payload.accountId ?? payload.employeeId)),
      tokenVersion: payload.tokenVersion ?? 0,
      now: new Date(),
    })

    if (token instanceof Error) throw token

    return token
  }

  return new SignJWT({
    ver: payload.tokenVersion ?? 0,
    purpose: "api-session",
    issuedAtMs: Date.now(),
  })
    .setProtectedHeader({ alg: "HS256", typ: ACCESS_TOKEN_TYPE })
    .setSubject(String(payload.accountId ?? payload.employeeId))
    .setIssuer(SYSTEM_ACCESS_TOKEN_ISSUER)
    .setAudience(SYSTEM_ACCESS_TOKEN_AUDIENCE)
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(options.expirationTime)
    .sign(new TextEncoder().encode(secret))
}
