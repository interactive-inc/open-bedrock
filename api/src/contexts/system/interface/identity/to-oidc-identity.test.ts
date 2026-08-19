import { describe, expect, test } from "bun:test"
import { toOidcIdentity } from "@/contexts/system/interface/identity/to-oidc-identity"

describe("toOidcIdentity", () => {
  test("有効ユーザーの確認済みメールをclaim用に詰め替える", () => {
    expect(
      toOidcIdentity({ id: "active", disabledAt: null }, [
        { email: "user@example.com", emailVerifiedAt: new Date(1) },
      ]),
    ).toEqual({
      subject: "active",
      email: "user@example.com",
      emailVerified: true,
    })
  })

  test("無効ユーザーはclaimへ変換しない", () => {
    expect(toOidcIdentity({ id: "disabled", disabledAt: new Date(1) }, [])).toBeNull()
  })
})
