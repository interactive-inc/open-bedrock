import { OidcValue, type OidcIssuerConfiguration } from "@system/domain/identity/oidc.value"
import { describe, expect, test } from "bun:test"

const configuration: OidcIssuerConfiguration = {
  issuersByHostname: {
    "issuer.example": "https://issuer.example",
    "issuer.example.localhost": "https://issuer.example.localhost",
  },
  localProxyHostnames: ["127.0.0.1", "localhost", "::1"],
  localIssuerHostname: "issuer.example.localhost",
}

describe("OidcValue", () => {
  test("公開プロトコルのアルゴリズム・寿命・scopeを固定する", () => {
    expect(OidcValue.ALGORITHM).toBe("ES256")
    expect(OidcValue.AUTHORIZATION_CODE_MAX_AGE_MS).toBe(120_000)
    expect(OidcValue.TOKEN_MAX_AGE_SECONDS).toBe(300)
    expect(OidcValue.SUPPORTED_SCOPES).toEqual(["openid", "profile", "email"])
    expect(Object.isFrozen(OidcValue.SUPPORTED_SCOPES)).toBe(true)
  })

  test("configurationに登録したcanonical HTTPS hostnameだけをissuerにする", () => {
    expect(
      OidcValue.issuer(
        { requestUrl: "https://issuer.example/oauth/authorize", forwardedHost: null },
        configuration,
      ),
    ).toBe("https://issuer.example")
    expect(
      OidcValue.issuer(
        { requestUrl: "http://issuer.example/oauth/authorize", forwardedHost: null },
        configuration,
      ),
    ).toBeInstanceOf(Error)
    expect(
      OidcValue.issuer(
        { requestUrl: "https://preview.example/oauth/authorize", forwardedHost: null },
        configuration,
      ),
    ).toBeInstanceOf(Error)
  })

  test("明示したloopback proxyから単一のlocal issuerだけを復元する", () => {
    expect(
      OidcValue.issuer(
        {
          requestUrl: "http://127.0.0.1:5173/oauth/authorize",
          forwardedHost: "issuer.example.localhost",
        },
        configuration,
      ),
    ).toBe("https://issuer.example.localhost")
    expect(
      OidcValue.issuer(
        {
          requestUrl: "http://127.0.0.1:5173/oauth/authorize",
          forwardedHost: "issuer.example",
        },
        configuration,
      ),
    ).toBeInstanceOf(Error)
  })

  test.each([
    ["comma ambiguity", "issuer.example.localhost, attacker.example"],
    ["userinfo", "user@issuer.example.localhost"],
    ["port", "issuer.example.localhost:444"],
    ["path", "issuer.example.localhost/evil"],
  ])("forwarded authorityの%sをfail closedで拒否する", (_name, forwardedHost) => {
    expect(
      OidcValue.issuer(
        {
          requestUrl: "http://127.0.0.1:5173/oauth/authorize",
          forwardedHost,
        },
        configuration,
      ),
    ).toBeInstanceOf(Error)
  })

  test("壊れたrequest URL・issuer設定・runtime configurationを例外にせず拒否する", () => {
    expect(
      OidcValue.issuer({ requestUrl: "not a URL", forwardedHost: null }, configuration),
    ).toBeInstanceOf(Error)
    expect(
      OidcValue.issuer(
        { requestUrl: "https://issuer.example/path", forwardedHost: null },
        {
          ...configuration,
          issuersByHostname: { "issuer.example": "http://issuer.example" },
        },
      ),
    ).toBeInstanceOf(Error)
    expect(
      OidcValue.issuer({ requestUrl: "https://issuer.example/path", forwardedHost: null }, {
        ...configuration,
        localProxyHostnames: null,
      } as unknown as OidcIssuerConfiguration),
    ).toBeInstanceOf(Error)
  })
})
