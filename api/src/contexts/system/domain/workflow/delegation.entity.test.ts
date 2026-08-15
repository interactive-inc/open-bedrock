import { Delegation } from "@system/domain/workflow/delegation.entity"
import { InvalidSystemWorkflowError } from "@system/domain/workflow/invalid-system-workflow.error"
import { describe, expect, test } from "bun:test"

const CREATED_AT = new Date("2026-08-16T00:00:00.000Z")
const STARTS_AT = new Date("2026-08-16T01:00:00.000Z")
const ENDS_AT = new Date("2026-08-17T01:00:00.000Z")
const SCOPE = { context: "expense", kind: "expense", id: "expense-1", version: "2" }

function delegationInput(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    id: "delegation-1",
    delegatorAccountId: "account-1",
    delegateAccountId: "account-2",
    scope: SCOPE,
    startsAt: STARTS_AT,
    endsAt: ENDS_AT,
    createdAt: CREATED_AT,
    revokedAt: null,
    ...overrides,
  }
}

function requireDelegation(input: unknown): Delegation {
  const delegation = Delegation.create(input)
  expect(delegation).toBeInstanceOf(Delegation)
  if (delegation instanceof Error) throw delegation

  return delegation
}

describe("Delegation", () => {
  test("半開区間と完全一致scopeで代理の有効性を判定する", () => {
    const delegation = requireDelegation(delegationInput())

    expect(delegation.isActiveAt(new Date(STARTS_AT.getTime() - 1), SCOPE)).toBe(false)
    expect(delegation.isActiveAt(STARTS_AT, SCOPE)).toBe(true)
    expect(delegation.isActiveAt(ENDS_AT, SCOPE)).toBe(false)
    expect(delegation.isActiveAt(STARTS_AT, { ...SCOPE, version: "3" })).toBe(false)
  })

  test("自己委任、空期間、開始後作成を拒否する", () => {
    expect(Delegation.create(delegationInput({ delegateAccountId: "account-1" }))).toBeInstanceOf(
      InvalidSystemWorkflowError,
    )
    expect(Delegation.create(delegationInput({ endsAt: STARTS_AT }))).toBeInstanceOf(
      InvalidSystemWorkflowError,
    )
    expect(Delegation.create(delegationInput({ createdAt: ENDS_AT }))).toBeInstanceOf(
      InvalidSystemWorkflowError,
    )
  })
})
