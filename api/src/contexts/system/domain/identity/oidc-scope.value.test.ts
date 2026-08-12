import { OidcScopeValue } from "@system/domain/identity/oidc-scope.value"
import { describe, expect, test } from "bun:test"

describe("OidcScopeValue", () => {
  test("重複を除き公開順へ正規化したimmutable snapshotを返す", () => {
    const scopes = OidcScopeValue.parse("email openid profile email")

    expect(scopes).toEqual(["openid", "profile", "email"])
    expect(Object.isFrozen(scopes)).toBe(true)
  })

  test("openid欠落、未対応scope、case違いを拒否する", () => {
    expect(OidcScopeValue.parse("profile")).toEqual(new Error("openid_scope_required"))
    expect(OidcScopeValue.parse("openid admin")).toEqual(new Error("unsupported_scope"))
    expect(OidcScopeValue.parse("OpenID")).toEqual(new Error("openid_scope_required"))
  })

  test("型違いと過大なscope inputを例外にせずfail closedで拒否する", () => {
    expect(OidcScopeValue.parse(null)).toEqual(new Error("invalid_scope"))
    expect(OidcScopeValue.parse("x".repeat(501))).toEqual(new Error("invalid_scope"))
    expect(
      OidcScopeValue.parse(
        `openid ${Array.from({ length: 51 }, (_, index) => `s${index}`).join(" ")}`,
      ),
    ).toBeInstanceOf(Error)
  })
})
