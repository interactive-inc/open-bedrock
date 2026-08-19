import { describe, expect, test } from "bun:test"
import { toOidcIdentity } from "@/contexts/system/interface/identity/to-oidc-identity"

describe("toOidcIdentity", () => {
  test("有効ユーザーの確認済みメールをclaim用に詰め替える", () => {
    expect(
      toOidcIdentity({ id: "active", name: "Active User", disabledAt: null }, [
        { email: "user@example.com", emailVerifiedAt: new Date(1) },
      ]),
    ).toEqual({
      subject: "active",
      name: "Active User",
      email: "user@example.com",
      emailVerified: true,
    })
  })

  test("無効ユーザーはclaimへ変換しない", () => {
    expect(
      toOidcIdentity({ id: "disabled", name: "Disabled User", disabledAt: new Date(1) }, []),
    ).toBeNull()
  })
})
