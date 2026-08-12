import {
  OidcClientPolicy,
  type OidcClientRegistry,
} from "@system/domain/identity/oidc-client.policy"
import { describe, expect, test } from "bun:test"

const registry: OidcClientRegistry = {
  "https://issuer.example": [
    {
      id: "web-client",
      name: "Web client",
      redirectUris: ["https://client.example/callback"],
    },
  ],
}

describe("OidcClientPolicy", () => {
  test("issuerごとの登録済みclientとredirect URI完全一致だけを許可する", () => {
    expect(
      OidcClientPolicy.resolve(
        {
          issuer: "https://issuer.example",
          clientId: "web-client",
          redirectUri: "https://client.example/callback",
        },
        registry,
      ),
    ).toEqual({
      id: "web-client",
      name: "Web client",
      redirectUris: ["https://client.example/callback"],
    })
    expect(
      OidcClientPolicy.resolve(
        {
          issuer: "https://issuer.example",
          clientId: "web-client",
          redirectUri: "https://client.example/callback/extra",
        },
        registry,
      ),
    ).toBeNull()
    expect(
      OidcClientPolicy.resolve(
        {
          issuer: "https://unknown.example",
          clientId: "web-client",
          redirectUri: "https://client.example/callback",
        },
        registry,
      ),
    ).toBeNull()
  })

  test("解決結果をmutable registryから切り離してfreezeする", () => {
    const redirectUris = ["https://client.example/callback"]
    const client = { id: "web-client", name: "Web client", redirectUris }
    const mutableRegistry = { "https://issuer.example": [client] }
    const resolved = OidcClientPolicy.resolve(
      {
        issuer: "https://issuer.example",
        clientId: "web-client",
        redirectUri: redirectUris[0]!,
      },
      mutableRegistry,
    )

    expect(resolved).not.toBeNull()
    if (resolved === null) return

    client.name = "Changed"
    redirectUris[0] = "https://attacker.example/callback"
    expect(resolved.name).toBe("Web client")
    expect(resolved.redirectUris).toEqual(["https://client.example/callback"])
    expect(Object.isFrozen(resolved)).toBe(true)
    expect(Object.isFrozen(resolved.redirectUris)).toBe(true)
  })

  test("重複client ID、重複redirect、危険なredirectを含むregistryを拒否する", () => {
    const props = {
      issuer: "https://issuer.example",
      clientId: "web-client",
      redirectUri: "https://client.example/callback",
    }
    const client = registry["https://issuer.example"]![0]!

    expect(
      OidcClientPolicy.resolve(props, {
        "https://issuer.example": [client, { ...client }],
      }),
    ).toBeNull()
    expect(
      OidcClientPolicy.resolve(props, {
        "https://issuer.example": [
          { ...client, redirectUris: [props.redirectUri, props.redirectUri] },
        ],
      }),
    ).toBeNull()
    expect(
      OidcClientPolicy.resolve(
        { ...props, redirectUri: "http://client.example/callback" },
        {
          "https://issuer.example": [
            { ...client, redirectUris: ["http://client.example/callback"] },
          ],
        },
      ),
    ).toBeNull()
  })

  test("loopback HTTP redirectだけは登録値との完全一致で許可する", () => {
    const loopbackRegistry = {
      "https://issuer.example": [
        {
          id: "native-client",
          name: "Native client",
          redirectUris: ["http://127.0.0.1:34567/callback"],
        },
      ],
    }

    expect(
      OidcClientPolicy.resolve(
        {
          issuer: "https://issuer.example",
          clientId: "native-client",
          redirectUri: "http://127.0.0.1:34567/callback",
        },
        loopbackRegistry,
      ),
    ).not.toBeNull()
  })

  test("accessor-backedなregistryとclientをgetter実行なしで拒否する", () => {
    let getterCalls = 0
    const accessorRegistry = Object.create(null) as Record<string, unknown>
    Object.defineProperty(accessorRegistry, "https://issuer.example", {
      enumerable: true,
      get: () => {
        getterCalls += 1
        return registry["https://issuer.example"]
      },
    })
    const accessorClient = {
      name: "Accessor client",
      redirectUris: ["https://client.example/callback"],
    }
    Object.defineProperty(accessorClient, "id", {
      enumerable: true,
      get: () => {
        getterCalls += 1
        return "web-client"
      },
    })
    const props = {
      issuer: "https://issuer.example",
      clientId: "web-client",
      redirectUri: "https://client.example/callback",
    }

    expect(
      OidcClientPolicy.resolve(props, accessorRegistry as unknown as OidcClientRegistry),
    ).toBeNull()
    expect(
      OidcClientPolicy.resolve(props, {
        "https://issuer.example": [accessorClient as unknown as never],
      }),
    ).toBeNull()
    expect(getterCalls).toBe(0)
  })
})
