import { describe, expect, test } from "bun:test"
import { OidcMetadataHandler } from "@/contexts/system/interface/http/oidc-metadata.handler"

const issuerConfiguration = Object.freeze({
  issuersByHostname: Object.freeze({ "identity.example.test": "https://identity.example.test" }),
  localProxyHostnames: Object.freeze(["127.0.0.1", "localhost", "::1"]),
  localIssuerHostname: "identity.example.test",
})

const coordinate = "A".repeat(43)
const signingKeysRaw = JSON.stringify({
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
})

describe("OidcMetadataHandler", () => {
  test("discoveryと公開鍵だけのJWKSをcanonical issuerで返す", async () => {
    const discovery = OidcMetadataHandler.handle({
      request: new Request("https://identity.example.test/.well-known/openid-configuration"),
      signingKeysRaw,
      issuerConfiguration,
    })
    const jwks = OidcMetadataHandler.handle({
      request: new Request("https://identity.example.test/.well-known/jwks.json"),
      signingKeysRaw,
      issuerConfiguration,
    })

    expect(discovery?.status).toBe(200)
    expect(await discovery?.json()).toMatchObject({
      issuer: "https://identity.example.test",
      id_token_signing_alg_values_supported: ["ES256"],
    })
    expect(jwks?.headers.get("access-control-allow-origin")).toBe("*")
    expect(await jwks?.text()).not.toContain('"d":')
  })

  test("対象外pathを処理せず、鍵未設定は503で閉じる", () => {
    expect(
      OidcMetadataHandler.handle({
        request: new Request("https://identity.example.test/"),
        signingKeysRaw,
        issuerConfiguration,
      }),
    ).toBeNull()
    expect(
      OidcMetadataHandler.handle({
        request: new Request("https://identity.example.test/.well-known/jwks.json"),
        signingKeysRaw: undefined,
        issuerConfiguration,
      })?.status,
    ).toBe(503)
  })
})
