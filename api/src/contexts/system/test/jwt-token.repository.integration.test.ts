import { describe, expect, test } from "bun:test"
import { signJwtToken } from "@system/infrastructure/auth/sign-jwt-token.repository"
import { verifyJwtToken } from "@system/infrastructure/auth/verify-jwt-token.repository"

describe("JWT token functions", () => {
  test("HS256で署名したpayloadを同じsecretだけで検証する", async () => {
    const token = await signJwtToken(
      { sub: "user-1", exp: Math.floor(Date.now() / 1000) + 60 },
      "secret",
    )

    expect((await verifyJwtToken(token, "secret")).sub).toBe("user-1")
    expect(verifyJwtToken(token, "other-secret")).rejects.toThrow()
  })
})
