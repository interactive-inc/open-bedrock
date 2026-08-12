import { InvalidRoleBindingError } from "@system/domain/iam/invalid-role-binding.error"
import { RoleBinding } from "@system/domain/iam/role-binding.entity"
import { describe, expect, test } from "bun:test"

const CREATED_AT = new Date("2026-08-11T00:00:00.000Z")
const REVOKED_AT = new Date("2026-08-11T00:01:00.000Z")

function bindingProps(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    id: "binding-1",
    accountId: "account-1",
    roleId: "role-1",
    resource: null,
    createdAt: CREATED_AT,
    revokedAt: null,
    ...overrides,
  }
}

function requireBinding(input: unknown): RoleBinding {
  const binding = RoleBinding.create(input)
  expect(binding).toBeInstanceOf(RoleBinding)
  if (binding instanceof Error) throw binding
  return binding
}

describe("RoleBinding", () => {
  test("global bindingは全resourceへ、resource bindingは完全一致だけへ適用する", () => {
    const global = requireBinding(bindingProps())
    const scoped = requireBinding(
      bindingProps({ resource: { type: "company:facility", id: "Facility-A" } }),
    )

    expect(global.appliesTo(null)).toBe(true)
    expect(global.appliesTo({ type: "care:resident", id: "resident-1" })).toBe(true)
    expect(scoped.appliesTo(null)).toBe(false)
    expect(scoped.appliesTo({ type: "company:facility", id: "Facility-A" })).toBe(true)
    expect(scoped.appliesTo({ type: "company:facility", id: "facility-a" })).toBe(false)
  })

  test("作成・失効時刻からactive状態を導出し、revocationを冪等にする", () => {
    const binding = requireBinding(bindingProps())
    const revoked = binding.revoke(REVOKED_AT)
    expect(revoked).toBeInstanceOf(RoleBinding)
    if (revoked instanceof Error) throw revoked

    expect(binding.isActiveAt(CREATED_AT)).toBe(true)
    expect(revoked.isActiveAt(new Date(REVOKED_AT.getTime() - 1))).toBe(true)
    expect(revoked.isActiveAt(REVOKED_AT)).toBe(false)
    expect(revoked.revoke(new Date(REVOKED_AT.getTime() + 1))).toBe(revoked)
  })

  test("resourceとDateの可変参照を保持・公開しない", () => {
    const resource = { type: "company:facility", id: "facility-1" }
    const createdAt = new Date(CREATED_AT)
    const binding = requireBinding(bindingProps({ resource, createdAt }))

    resource.id = "changed"
    createdAt.setUTCFullYear(2030)
    binding.createdAt.setUTCFullYear(2031)

    expect(binding.resource).toEqual({ type: "company:facility", id: "facility-1" })
    expect(binding.createdAt).toEqual(CREATED_AT)
    expect(Object.isFrozen(binding.resource)).toBe(true)
    expect(Object.isFrozen(binding)).toBe(true)
  })

  test.each([
    [bindingProps({ extra: true }), "invalid_shape"],
    [bindingProps({ accountId: "" }), "invalid_shape"],
    [bindingProps({ resource: { type: "facility", id: "f-1" } }), "invalid_shape"],
    [bindingProps({ resource: { type: "company:facility", id: "" } }), "invalid_shape"],
    [bindingProps({ revokedAt: new Date(CREATED_AT.getTime() - 1) }), "revocation_before_creation"],
  ] as const)("破損bindingをfail closedで拒否する", (input, reason) => {
    const binding = RoleBinding.create(input)

    expect(binding).toBeInstanceOf(InvalidRoleBindingError)
    expect(binding instanceof InvalidRoleBindingError ? binding.reason : null).toBe(reason)
  })
})
