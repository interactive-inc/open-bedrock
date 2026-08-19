import { describe, expect, test } from "bun:test"
import { OidcCryptographyService } from "@/contexts/system/infrastructure/identity/oidc-cryptography.service"

describe("OidcCryptographyService", () => {
  test("32byte secretを43文字base64urlで生成し、平文をSHA-256へ変換する", async () => {
    const secret = OidcCryptographyService.createSecret()
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(await OidcCryptographyService.hashSecret(secret)).toMatch(/^[a-f0-9]{64}$/)
  })

  test("RFC 7636のPKCE既知ベクタと一致する", async () => {
    expect(
      await OidcCryptographyService.createPkceChallenge(
        "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
      ),
    ).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")
  })
})
