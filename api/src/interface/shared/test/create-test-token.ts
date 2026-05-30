import type { TokenPayload } from "@/domain/auth/token-payload"
import { SignJWT } from "jose"

export function createTestToken(secret: string, payload: TokenPayload): Promise<string> {
  return new SignJWT({
    employeeId: payload.employeeId,
    email: payload.email,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(new TextEncoder().encode(secret))
}
