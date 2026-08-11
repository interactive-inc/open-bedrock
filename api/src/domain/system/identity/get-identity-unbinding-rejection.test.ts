import { describe, expect, test } from "bun:test"
import { IdentityBinding } from "@system/domain/identity/identity-binding.entity"
import { getIdentityUnbindingRejection } from "@system/domain/identity/get-identity-unbinding-rejection"

const CREATED_AT = new Date("2026-08-11T00:00:00.000Z")

function activeBinding(
  id: string,
  overrides: Readonly<Record<string, unknown>> = {},
): IdentityBinding {
  const binding = IdentityBinding.create({
    id,
    accountId: "account-1",
    provider: id === "identity-1" ? "password" : "oidc",
    subject: `${id}-subject`,
    createdAt: CREATED_AT,
    activatedAt: CREATED_AT,
    revokedAt: null,
    ...overrides,
  })

  if (binding instanceof Error) throw binding
  return binding
}

describe("getIdentityUnbindingRejection", () => {
  test("別のactive bindingがあれば対象を解除できる", () => {
    expect(
      getIdentityUnbindingRejection("identity-1", [
        activeBinding("identity-1"),
        activeBinding("identity-2"),
      ]),
    ).toBeNull()
  })

  test("最後のactive bindingを解除しない", () => {
    expect(getIdentityUnbindingRejection("identity-1", [activeBinding("identity-1")])).toBe(
      "last_active_identity_binding",
    )
  })

  test("不存在・pending・revoked targetをactiveとして扱わない", () => {
    const active = activeBinding("identity-1")
    const pending = activeBinding("identity-2", { activatedAt: null })
    const revoked = activeBinding("identity-3", { revokedAt: CREATED_AT })

    expect(getIdentityUnbindingRejection("unknown", [active])).toBe("identity_not_active")
    expect(getIdentityUnbindingRejection(pending.id, [active, pending])).toBe("identity_not_active")
    expect(getIdentityUnbindingRejection(revoked.id, [active, revoked])).toBe("identity_not_active")
  })

  test("重複ID・重複provider subject・複数Accountの壊れた集合を拒否する", () => {
    const first = activeBinding("identity-1")
    const duplicateId = activeBinding("identity-1", { provider: "oidc", subject: "other" })
    const duplicateProviderSubject = activeBinding("identity-2", {
      provider: first.provider,
      subject: first.subject,
    })
    const anotherAccount = activeBinding("identity-2", { accountId: "account-2" })

    for (const bindings of [
      [first, duplicateId],
      [first, duplicateProviderSubject],
      [first, anotherAccount],
    ]) {
      expect(getIdentityUnbindingRejection(first.id, bindings)).toBe(
        "invalid_identity_binding_collection",
      )
    }
  })

  test("Domain aggregate以外を含むuntrusted collectionを拒否する", () => {
    expect(getIdentityUnbindingRejection("identity-1", {})).toBe(
      "invalid_identity_binding_collection",
    )
    expect(getIdentityUnbindingRejection("identity-1", [{}])).toBe(
      "invalid_identity_binding_collection",
    )
  })
})
