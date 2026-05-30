import type { TokenPayload } from "@/domain/auth/token-payload"
import { SignJWT } from "jose"

export class JoseTokenSigner {
  constructor() {
    Object.freeze(this)
  }

  async sign(payload: TokenPayload, jwtSecret: string): Promise<string | Error> {
    try {
      const encodedSecret = new TextEncoder().encode(jwtSecret)

      const claims = {
        employeeId: payload.employeeId,
        email: payload.email,
        role: payload.role,
      }

      return await new SignJWT(claims)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .sign(encodedSecret)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("token signing failed")
    }
  }
}
