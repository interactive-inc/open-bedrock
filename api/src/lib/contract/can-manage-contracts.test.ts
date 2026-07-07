import { canManageContracts } from "@/lib/contract/can-manage-contracts"
import { makeTestSession } from "@/interface/shared/test/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canManageContracts", () => {
  test("admin can manage", () => {
    expect(canManageContracts(makeTestSession("admin"))).toBe(true)
  })

  test("hr cannot manage", () => {
    expect(canManageContracts(makeTestSession("hr"))).toBe(false)
  })

  test("member cannot manage", () => {
    expect(canManageContracts(makeTestSession("member"))).toBe(false)
  })
})
