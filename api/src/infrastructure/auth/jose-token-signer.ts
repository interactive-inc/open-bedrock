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

      // 有効期限を付与する。web セッション cookie の maxAge（8時間）と揃える。
      // 期限切れトークンは検証側（verifyBearer）の jwtVerify が exp を見て弾く。
      return await new SignJWT(claims)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("8h")
        .sign(encodedSecret)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("token signing failed")
    }
  }
}
