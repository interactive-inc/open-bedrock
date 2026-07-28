import { describe, expect, test } from "bun:test"

import { cliIdentityRedirectUri } from "@/lib/auth/cli-identity-redirect-uri"

describe("cliIdentityRedirectUri", () => {
  test("HTTPS originから固定callbackを作る", () => {
    expect(cliIdentityRedirectUri("https://api.example.com")).toBe(
      "https://api.example.com/auth/cli/callback",
    )
  })

  test("loopback HTTPを許可する", () => {
    expect(cliIdentityRedirectUri("http://127.0.0.1:18787")).toBe(
      "http://127.0.0.1:18787/auth/cli/callback",
    )
  })

  test("外部HTTP、path、query、credentialsを拒否する", () => {
    expect(cliIdentityRedirectUri("http://api.example.com")).toBeInstanceOf(Error)
    expect(cliIdentityRedirectUri("https://api.example.com/path")).toBeInstanceOf(Error)
    expect(cliIdentityRedirectUri("https://api.example.com?mode=1")).toBeInstanceOf(Error)
    expect(cliIdentityRedirectUri("https://user:pass@api.example.com")).toBeInstanceOf(Error)
  })
})
