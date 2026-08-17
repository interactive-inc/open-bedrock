import { ACCESS_TOKEN_TYPE } from "@/contexts/system/domain/auth/access-token-claims"
import {
  ACCESS_TOKEN_AUDIENCE,
  ACCESS_TOKEN_ISSUER,
  JoseTokenSigner,
} from "@/contexts/company-compatibility/infrastructure/auth/jose-token-signer"
import { describe, expect, test } from "bun:test"
import { jwtVerify } from "jose"

const secret = "access-token-profile-test-secret"

describe("JoseTokenSigner", () => {
  test("Account主体の固定profileだけを発行する", async () => {
    const signed = await new JoseTokenSigner().sign({ accountId: 42, tokenVersion: 3 }, secret)

    expect(signed).not.toBeInstanceOf(Error)
    if (signed instanceof Error) return

    const verified = await jwtVerify(signed, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
      issuer: ACCESS_TOKEN_ISSUER,
      audience: ACCESS_TOKEN_AUDIENCE,
    })

    expect(verified.protectedHeader.typ).toBe(ACCESS_TOKEN_TYPE)
    expect(verified.payload.sub).toBe("42")
    expect(verified.payload.ver).toBe(3)
    expect(verified.payload.purpose).toBe("api-session")
    expect(verified.payload.jti).toBeString()
    expect(verified.payload.employeeId).toBeUndefined()
    expect(verified.payload.permissions).toBeUndefined()
  })
})
