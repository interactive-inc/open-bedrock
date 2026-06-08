import { JoseTokenSigner } from "@/infrastructure/auth/jose-token-signer"
import { describe, expect, test } from "bun:test"
import { jwtVerify } from "jose"

describe("JoseTokenSigner", () => {
  test("signs an HS256 token that expires 8 hours after issuance", async () => {
    const secret = "jose-token-signer-test-secret"

    const token = await new JoseTokenSigner().sign(
      { employeeId: 1, email: "you+e001@example.com", role: "admin" },
      secret,
    )

    if (token instanceof Error) {
      throw token
    }

    const verified = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
    })

    const exp = verified.payload.exp

    const iat = verified.payload.iat

    expect(typeof exp).toBe("number")
    expect(typeof iat).toBe("number")

    // exp は iat の 8 時間後（28800 秒）に設定される。
    if (typeof exp === "number" && typeof iat === "number") {
      expect(exp - iat).toBe(28800)
    }
  })
})
