import { toPkceS256Challenge, verifyPkceS256Challenge } from "@system/infrastructure/auth/pkce-s256"
import { describe, expect, test } from "bun:test"

const RFC_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
const RFC_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

describe("PKCE S256", () => {
  test("RFC 7636 Appendix Bの既知ベクタを導出する", async () => {
    expect(await toPkceS256Challenge(RFC_VERIFIER)).toBe(RFC_CHALLENGE)
  })

  test("正しいverifierとchallengeだけを一致とする", async () => {
    expect(await verifyPkceS256Challenge(RFC_VERIFIER, RFC_CHALLENGE)).toBe(true)
    expect(await verifyPkceS256Challenge("wrong-verifier", RFC_CHALLENGE)).toBe(false)
    expect(await verifyPkceS256Challenge(RFC_VERIFIER, "wrong-challenge")).toBe(false)
  })

  test("パディング付きbase64と空のchallengeを正準値として受理しない", async () => {
    expect(await verifyPkceS256Challenge(RFC_VERIFIER, `${RFC_CHALLENGE}=`)).toBe(false)
    expect(await verifyPkceS256Challenge(RFC_VERIFIER, "")).toBe(false)
  })
})
