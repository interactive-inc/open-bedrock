import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import {
  SYSTEM_ACCESS_TOKEN_AUDIENCE,
  SYSTEM_ACCESS_TOKEN_ISSUER,
} from "@system/lib/auth/system-access-token-profile"
import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"
import { ACCESS_TOKEN_TYPE } from "@system/domain/schemas/auth/access-token-claims.schema"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SignJWT } from "jose"

/**
 * canonical System Account access tokenを作るテスト入力。
 * accountId 省略時はemployeeIdを流用し、tokenVersion省略時はseed既定値の0を使う。
 */
export type TestTokenPayload = {
  employeeId: EmployeeId
  accountId?: number | string
  tokenVersion?: number
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
