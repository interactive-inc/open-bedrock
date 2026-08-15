import { describe, expect, test } from "bun:test"

import { createIdentityTestKey } from "@/lib/auth/test/create-identity-test-key"
import { createIdentityToken } from "@/lib/auth/test/create-identity-token"
import { verifyIdentityToken } from "@/lib/auth/verify-identity-token"

const identityKey = await createIdentityTestKey()
const wrongIdentityKey = await createIdentityTestKey("wrong-key")
const issuer = "https://identity-provider.example/"
const audience = "open-karte"
const nowEpoch = 1_767_225_600
const now = new Date(nowEpoch * 1_000)

function verify(token: string) {
  return verifyIdentityToken({
    token,
    verificationKey: identityKey.verificationKey,
    issuer,
    audience,
    now,
  })
}

describe("verifyIdentityToken", () => {
  test("accepts a valid EdDSA token and returns its claims", async () => {
    const token = await createIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: "ext-1",
      jti: "jti-1",
    })

    const claims = await verify(token)

    if ("reason" in claims) throw new Error("expected valid claims")
    expect(claims.sub).toBe("ext-1")
    expect(claims.email).toBe("you+ext@example.com")
    expect(claims.email_verified).toBe(true)
    expect(claims.name).toBe("External Worker")
    expect(claims.jti).toBe("jti-1")
  })

  test("rejects a token signed with a key outside the JWKS", async () => {
    const token = await createIdentityToken(wrongIdentityKey.signingKey, nowEpoch, {
      keyId: wrongIdentityKey.keyId,
    })

    expect(await verify(token)).toEqual({ reason: "invalid_token" })
  })

  test("rejects a token with an unexpected issuer", async () => {
    const token = await createIdentityToken(identityKey.signingKey, nowEpoch, {
      issuer: "https://attacker.example/",
    })

    expect(await verify(token)).toEqual({ reason: "invalid_token" })
  })

  test("rejects a token with an unexpected audience", async () => {
    const token = await createIdentityToken(identityKey.signingKey, nowEpoch, {
      audience: "some-other-app",
    })

    expect(await verify(token)).toEqual({ reason: "invalid_token" })
  })

  test("rejects an expired token", async () => {
    const token = await createIdentityToken(identityKey.signingKey, nowEpoch - 120, {
      exp: nowEpoch - 60,
      iat: nowEpoch - 120,
    })

    expect(await verify(token)).toEqual({ reason: "invalid_token" })
  })

  test("rejects a token missing required claims", async () => {
    const token = await createIdentityToken(identityKey.signingKey, nowEpoch, { jti: "" })

    expect(await verify(token)).toEqual({ reason: "invalid_token" })
  })
})
