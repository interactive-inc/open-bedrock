import { jwtVerify, type JWTPayload } from "jose"

/** HS256 System JWTを検証してpayloadを返す。 */
export async function verifyJwtToken(token: string, secret: string): Promise<JWTPayload> {
  return (
    await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
    })
  ).payload
}
