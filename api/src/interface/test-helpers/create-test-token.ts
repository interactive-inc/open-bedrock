import { SignJWT } from "jose"

/**
 * テスト用トークンの payload。後方互換のため email/role も受け付けるが署名には載せない。
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
 * options.expirationTime に jose の相対指定（"8h" など）か絶対 epoch 秒を渡せる。
 * 省略時は exp を付けない（既存テストの後方互換のため）。
 */
export function createTestToken(
  secret: string,
  payload: TestTokenPayload,
  options?: { expirationTime?: string | number },
): Promise<string> {
  const builder = new SignJWT({
    accountId: payload.accountId ?? payload.employeeId,
    employeeId: payload.employeeId,
    tokenVersion: payload.tokenVersion ?? 0,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()

  if (options?.expirationTime !== undefined) {
    builder.setExpirationTime(options.expirationTime)
  }

  return builder.sign(new TextEncoder().encode(secret))
}
