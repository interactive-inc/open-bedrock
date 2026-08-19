import { jwtVerify, SignJWT, type JWTPayload, type JWTVerifyResult } from "jose"

export class JwtTokenService {
  static sign(payload: JWTPayload, secret: string, type = "JWT"): Promise<string> {
    return new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256", typ: type })
      .sign(new TextEncoder().encode(secret))
  }

  static async verify(token: string, secret: string): Promise<JWTPayload> {
    return (await JwtTokenService.verifyWithHeader(token, secret)).payload
  }

  static verifyWithHeader(token: string, secret: string): Promise<JWTVerifyResult> {
    return jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
    })
  }
}
