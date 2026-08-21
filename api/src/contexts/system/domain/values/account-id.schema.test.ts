import { zAccountId } from "@system/domain/values/account-id.schema"
import { describe, expect, test } from "bun:test"

describe("AccountId value", () => {
  test("数字だけのopaque IDを文字列のまま保持する", () => {
    expect(String(zAccountId.parse("001"))).toBe("001")
  })

  test("大文字小文字を正規化しない", () => {
    expect(String(zAccountId.parse("Account-A"))).toBe("Account-A")
    expect(String(zAccountId.parse("account-a"))).toBe("account-a")
  })

  test("空文字、255文字超、非文字列を拒否する", () => {
    expect(zAccountId.safeParse("").success).toBe(false)
    expect(zAccountId.safeParse("a".repeat(256)).success).toBe(false)
    expect(zAccountId.safeParse(1).success).toBe(false)
  })
})
