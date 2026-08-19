import { describe, expect, test } from "bun:test"
import { JwtTokenService } from "@/contexts/system/infrastructure/auth/jwt-token.service"

describe("JwtTokenService", () => {
  test("HS256で署名したpayloadを同じsecretだけで検証する", async () => {
    const token = await JwtTokenService.sign(
      { sub: "user-1", exp: Math.floor(Date.now() / 1000) + 60 },
      "secret",
    )

    expect((await JwtTokenService.verify(token, "secret")).sub).toBe("user-1")
    await expect(JwtTokenService.verify(token, "other-secret")).rejects.toThrow()
  })
})
