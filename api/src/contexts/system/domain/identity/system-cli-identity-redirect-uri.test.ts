import { describe, expect, test } from "bun:test"

import { systemCliIdentityRedirectUri } from "@system/domain/identity/system-cli-identity-redirect-uri"

describe("systemCliIdentityRedirectUri", () => {
  test("HTTPS originから固定callbackを作る", () => {
    expect(systemCliIdentityRedirectUri("https://api.example.com")).toBe(
      "https://api.example.com/system/v1/cli-authorization-callback",
    )
  })

  test("loopback HTTPを許可する", () => {
    expect(systemCliIdentityRedirectUri("http://127.0.0.1:18787")).toBe(
      "http://127.0.0.1:18787/system/v1/cli-authorization-callback",
    )
  })

  test("外部HTTP、path、query、credentialsを拒否する", () => {
    expect(systemCliIdentityRedirectUri("http://api.example.com")).toBeInstanceOf(Error)
    expect(systemCliIdentityRedirectUri("https://api.example.com/path")).toBeInstanceOf(Error)
    expect(systemCliIdentityRedirectUri("https://api.example.com?mode=1")).toBeInstanceOf(Error)
    expect(systemCliIdentityRedirectUri("https://user:pass@api.example.com")).toBeInstanceOf(Error)
  })
})
