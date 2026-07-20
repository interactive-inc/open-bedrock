import { canViewAllContracts } from "@/lib/contract/can-view-all-contracts"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canViewAllContracts", () => {
  test("admin can view all", () => {
    expect(canViewAllContracts(makeTestSession("admin"))).toBe(true)
  })

  test("hr cannot view all", () => {
    expect(canViewAllContracts(makeTestSession("hr"))).toBe(false)
  })

  test("member cannot view all", () => {
    expect(canViewAllContracts(makeTestSession("member"))).toBe(false)
  })
})
