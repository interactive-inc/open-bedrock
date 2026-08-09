import { jwtVerify, SignJWT } from "jose"
import {
  ACCESS_TOKEN_TYPE,
  type AccessTokenClaims,
  zAccessTokenClaims,
} from "../../../domain/system/auth/access-token-claims"

export type AccessTokenProfile = Readonly<{
  issuer: string
  audience: string
  purpose: AccessTokenClaims["purpose"]
  maxAgeSeconds: number
}>

export type AccessTokenInput = Readonly<{
  accountId: string
  tokenVersion: number
}>

export type AccessTokenService = Readonly<{
  create(input: AccessTokenInput, secret: string): Promise<string>
  verify(token: string, secret: string): Promise<AccessTokenClaims>
}>

/** Account だけを主体にする access token 境界。 */
export function createAccessTokenService(profile: AccessTokenProfile): AccessTokenService {
  if (
    profile.issuer.length === 0 ||
    profile.audience.length === 0 ||
    !Number.isSafeInteger(profile.maxAgeSeconds) ||
    profile.maxAgeSeconds <= 0
  ) {
    throw new Error("invalid access token profile")
  }

  const tokenProfile = Object.freeze({ ...profile })
  const toKey = (secret: string): Uint8Array => {
    if (secret.length === 0) {
      throw new Error("access token secret is missing")
    }

    return new TextEncoder().encode(secret)
  }

  return Object.freeze({
    async create(input: AccessTokenInput, secret: string): Promise<string> {
      const key = toKey(secret)
      const issuedAtMs = Date.now()
      const issuedAtSeconds = Math.floor(issuedAtMs / 1000)
      const claims = zAccessTokenClaims.parse({
        sub: input.accountId,
        ver: input.tokenVersion,
        purpose: tokenProfile.purpose,
        iss: tokenProfile.issuer,
        aud: tokenProfile.audience,
        jti: crypto.randomUUID(),
        iat: issuedAtSeconds,
        issuedAtMs,
        exp: issuedAtSeconds + tokenProfile.maxAgeSeconds,
      })

      return new SignJWT(claims)
        .setProtectedHeader({ alg: "HS256", typ: ACCESS_TOKEN_TYPE })
        .sign(key)
    },

    async verify(token: string, secret: string): Promise<AccessTokenClaims> {
      const verified = await jwtVerify(token, toKey(secret), {
        algorithms: ["HS256"],
        typ: ACCESS_TOKEN_TYPE,
        issuer: tokenProfile.issuer,
        audience: tokenProfile.audience,
        maxTokenAge: tokenProfile.maxAgeSeconds,
      })
      const claims = zAccessTokenClaims.parse(verified.payload)

      if (
        claims.purpose !== tokenProfile.purpose ||
        claims.exp - claims.iat > tokenProfile.maxAgeSeconds ||
        Math.floor(claims.issuedAtMs / 1000) !== claims.iat
      ) {
        throw new Error("access token does not match the required profile")
      }

      return claims
    },
  })
}
