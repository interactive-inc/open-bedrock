import { createPkce } from "@/contexts/company/infrastructure/system-compatibility/auth/create-pkce"
import { verifyPkceS256Challenge } from "@system/infrastructure/auth/pkce-s256"
import { describe, expect, test } from "bun:test"

describe("createPkce", () => {
  test("RFC 7636のverifierとS256 challengeを生成する", async () => {
    const pkce = await createPkce()

    expect(pkce.verifier).toMatch(/^[A-Za-z0-9._~-]{43,128}$/)
    expect(pkce.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(await verifyPkceS256Challenge(pkce.verifier, pkce.challenge)).toBe(true)
  })

  test("要求ごとに異なるverifierを生成する", async () => {
    const first = await createPkce()
    const second = await createPkce()

    expect(first.verifier).not.toBe(second.verifier)
  })
})
