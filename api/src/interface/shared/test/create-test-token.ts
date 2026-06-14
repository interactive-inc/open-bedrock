import type { TokenPayload } from "@/lib/auth/token-payload"
import { SignJWT } from "jose"

// options.expirationTime に jose の相対指定（"8h" など）か絶対 epoch 秒を渡せる。
// 省略時は exp を付けない（既存テストの後方互換のため）。
export function createTestToken(
  secret: string,
  payload: TokenPayload,
  options?: { expirationTime?: string | number },
): Promise<string> {
  const builder = new SignJWT({
    employeeId: payload.employeeId,
    email: payload.email,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()

  if (options?.expirationTime !== undefined) {
    builder.setExpirationTime(options.expirationTime)
  }

  return builder.sign(new TextEncoder().encode(secret))
}
