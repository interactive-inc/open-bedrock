import {
  ACCESS_TOKEN_AUDIENCE,
  ACCESS_TOKEN_ISSUER,
  JoseTokenSigner,
} from "@/contexts/company-compatibility/infrastructure/auth/jose-token-signer"
import { ACCESS_TOKEN_TYPE } from "@/contexts/system/domain/auth/access-token-claims"
import { SignJWT } from "jose"

/**
 * テスト用トークンの入力。後方互換のため email/role も受け付けるが署名には載せない。
 * accountId 省略時は employeeId を流用(テストは account.id=employee.id で seed する)、
 * tokenVersion 省略時は 0(seed の既定値)。
 */
export type TestTokenPayload = {
  employeeId: number
  accountId?: number
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
    const token = await new JoseTokenSigner().sign(
      {
        accountId: payload.accountId ?? payload.employeeId,
        tokenVersion: payload.tokenVersion ?? 0,
      },
      secret,
    )

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
    .setIssuer(ACCESS_TOKEN_ISSUER)
    .setAudience(ACCESS_TOKEN_AUDIENCE)
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(options.expirationTime)
    .sign(new TextEncoder().encode(secret))
}
