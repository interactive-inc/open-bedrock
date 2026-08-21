import { describe, expect, test } from "bun:test"
import { getOidcPublicKeys } from "@system/infrastructure/identity/get-oidc-public-keys.repository"
import { parseOidcSigningKeys } from "@system/infrastructure/identity/parse-oidc-signing-keys.repository"

const coordinate = "A".repeat(43)

describe("OIDC signing key functions", () => {
  test("秘密鍵設定を検証し、公開鍵からdを除外する", () => {
    const keys = parseOidcSigningKeys(
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

    expect(getOidcPublicKeys(keys)).toEqual([
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
    expect(parseOidcSigningKeys(undefined)).toEqual(new Error("oidc_signing_keys_missing"))
    expect(parseOidcSigningKeys("{")).toEqual(new Error("oidc_signing_keys_invalid"))
  })
})
