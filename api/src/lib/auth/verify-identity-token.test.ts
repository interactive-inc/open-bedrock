import { describe, expect, test } from "bun:test"
import { createIdentityToken } from "@/interface/test-helpers/create-identity-token"
import { verifyIdentityToken } from "@/lib/auth/verify-identity-token"

const secret = "identity-token-test-secret"
const issuer = "https://identity-provider.example/"
const audience = "open-karte"
const nowEpoch = 1_767_225_600
const now = new Date(nowEpoch * 1_000)

function verify(token: string) {
  return verifyIdentityToken({ token, secret, issuer, audience, now })
}

describe("verifyIdentityToken", () => {
  test("accepts a valid token and returns its claims", async () => {
    const token = await createIdentityToken(secret, nowEpoch, { sub: "ext-1", jti: "jti-1" })

    const result = await verify(token)

    if ("reason" in result) throw new Error("expected valid claims")
    expect(result.sub).toBe("ext-1")
    expect(result.email).toBe("you+ext@example.com")
    expect(result.email_verified).toBe(true)
    expect(result.name).toBe("External Worker")
    expect(result.jti).toBe("jti-1")
  })

  test("rejects a token signed with the wrong secret", async () => {
    const token = await createIdentityToken("a-different-secret", nowEpoch)

    expect(await verify(token)).toEqual({ reason: "invalid_token" })
  })

  test("rejects a token with an unexpected issuer", async () => {
    const token = await createIdentityToken(secret, nowEpoch, {
      issuer: "https://attacker.example/",
    })

    expect(await verify(token)).toEqual({ reason: "invalid_token" })
  })

  test("rejects a token with an unexpected audience", async () => {
    const token = await createIdentityToken(secret, nowEpoch, { audience: "some-other-app" })

    expect(await verify(token)).toEqual({ reason: "invalid_token" })
  })

  test("rejects an expired token", async () => {
    // 発行から 60 秒で失効する短命トークンが、検証時刻より前に失効している。
    const token = await createIdentityToken(secret, nowEpoch - 120, {
      exp: nowEpoch - 60,
      iat: nowEpoch - 120,
    })

    expect(await verify(token)).toEqual({ reason: "invalid_token" })
  })

  test("rejects a token missing required claims", async () => {
    // jti を空にすると claims スキーマ検証で弾かれる。
    const token = await createIdentityToken(secret, nowEpoch, { jti: "" })

    expect(await verify(token)).toEqual({ reason: "invalid_token" })
  })
})
