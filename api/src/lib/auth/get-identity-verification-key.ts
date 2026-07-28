import { createLocalJWKSet, createRemoteJWKSet } from "jose"
import { z } from "zod"

import type { Bindings } from "@/env"
import type { JWTVerifyGetKey } from "jose"
import { isSecureIdentityIssuer } from "@/lib/auth/is-secure-identity-issuer"

const jwksSchema = z.object({
  keys: z
    .array(
      z
        .object({
          kty: z.literal("OKP"),
          crv: z.literal("Ed25519"),
          x: z.string().min(1),
          kid: z.string().min(1),
          alg: z.literal("EdDSA").optional(),
          use: z.literal("sig").optional(),
        })
        .strict(),
    )
    .min(1),
})

const remoteKeys = new Map<string, JWTVerifyGetKey>()

/**
 * 本番はissuerのJWKS endpoint、ローカルとテストは注入されたpublic JWKSを使う。
 */
export function getIdentityVerificationKey(env: Bindings): JWTVerifyGetKey | Error {
  if (env.IDENTITY_JWKS !== undefined) {
    try {
      const parsed = jwksSchema.safeParse(JSON.parse(env.IDENTITY_JWKS))
      if (parsed.success === false) {
        return new Error("identity JWKS is invalid")
      }

      return createLocalJWKSet(parsed.data)
    } catch {
      return new Error("identity JWKS is invalid")
    }
  }

  if (env.IDENTITY_ISSUER === undefined || env.IDENTITY_ISSUER.length === 0) {
    return new Error("identity issuer is not configured")
  }

  try {
    const issuer = new URL(env.IDENTITY_ISSUER)
    if (
      !isSecureIdentityIssuer(issuer) ||
      issuer.username !== "" ||
      issuer.password !== "" ||
      issuer.pathname !== "/" ||
      issuer.search !== "" ||
      issuer.hash !== ""
    ) {
      return new Error("identity issuer must use HTTPS")
    }

    const url = new URL("/.well-known/jwks.json", issuer.origin)
    const cached = remoteKeys.get(url.href)
    if (cached !== undefined) {
      return cached
    }

    const key = createRemoteJWKSet(url, {
      timeoutDuration: 5_000,
      cooldownDuration: 30_000,
      cacheMaxAge: 5 * 60 * 1_000,
    })
    remoteKeys.set(url.href, key)

    return key
  } catch {
    return new Error("identity JWKS URL is invalid")
  }
}
