import { describe, expect, test } from "bun:test"
import { IssuedEmailValue } from "@/contexts/system/domain/identity/issued-email.value"

const domain = "accounts.example"

describe("buildIssuedEmail", () => {
  test("ローカル部とconfigurationのdomainを結合する", () => {
    expect(IssuedEmailValue.buildIssuedEmail("emp001", domain)).toBe("emp001@accounts.example")
  })

  test("opaque IDをローカル部にしても発番アドレスを保つ", () => {
    const accountId = "9b3f2a8c-9b4e-4c2a-8f1d-2e6b7a9c0d1e"

    expect(IssuedEmailValue.buildIssuedEmail(accountId, domain)).toBe(
      `${accountId}@accounts.example`,
    )
  })
})

describe("isIssuedEmail", () => {
  test("configurationのdomainで終わるアドレスを発番アドレスと判定する", () => {
    expect(IssuedEmailValue.isIssuedEmail("emp001@accounts.example", domain)).toBe(true)
  })

  test("別domainのアドレスを発番アドレスと判定しない", () => {
    expect(IssuedEmailValue.isIssuedEmail("user@example.com", domain)).toBe(false)
  })

  test("domainを含んでも末尾でなければ部分一致で誤判定しない", () => {
    expect(IssuedEmailValue.isIssuedEmail("accounts.example@example.com", domain)).toBe(false)
  })
})
