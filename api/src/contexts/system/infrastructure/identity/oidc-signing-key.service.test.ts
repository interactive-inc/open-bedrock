import { describe, expect, test } from "bun:test"
import { OidcSigningKeyService } from "@/contexts/system/infrastructure/identity/oidc-signing-key.service.repository"

const coordinate = "A".repeat(43)

describe("OidcSigningKeyService", () => {
  test("秘密鍵設定を検証し、公開鍵からdを除外する", () => {
    const keys = OidcSigningKeyService.parse(
      JSON.stringify({
        active: {
          kty: "EC",
          crv: "P-256",
          x: coordinate,
          y: coordinate,
          d: coordinate,
          kid: "active-key",
          use: "sig",
          alg: "ES256",
        },
        previous: [],
      }),
    )
    if (keys instanceof Error) {
      throw keys
    }

    expect(OidcSigningKeyService.publicKeys(keys)).toEqual([
      {
        kty: "EC",
        crv: "P-256",
        x: coordinate,
        y: coordinate,
        kid: "active-key",
        use: "sig",
        alg: "ES256",
      },
    ])
  })

  test("未設定・壊れたJSON・重複kidを拒否する", () => {
    expect(OidcSigningKeyService.parse(undefined)).toEqual(new Error("oidc_signing_keys_missing"))
    expect(OidcSigningKeyService.parse("{")).toEqual(new Error("oidc_signing_keys_invalid"))
  })
})
