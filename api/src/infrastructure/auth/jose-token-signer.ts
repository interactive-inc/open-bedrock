import { assertJwtSecret } from "@/lib/auth/assert-jwt-secret"
import type { TokenPayload } from "@/lib/auth/token-payload"
import { SignJWT } from "jose"

export class JoseTokenSigner {
  constructor() {
    Object.freeze(this)
  }

  async sign(payload: TokenPayload, jwtSecret: string): Promise<string | Error> {
    // try の外で落とす。設定不備を「署名失敗」に丸めず UnavailableError として伝える。
    assertJwtSecret(jwtSecret)

    try {
      const encodedSecret = new TextEncoder().encode(jwtSecret)

      const claims = {
        accountId: payload.accountId,
        employeeId: payload.employeeId,
        tokenVersion: payload.tokenVersion,
      }

      return await new SignJWT(claims)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(encodedSecret)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("token signing failed")
    }
  }
}
