import { canManageFamilyCareLeaves } from "@/lib/family-care-leave/can-manage-family-care-leaves"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canManageFamilyCareLeaves", () => {
  test("hr can manage", () => {
    expect(canManageFamilyCareLeaves(makeTestSession("hr"))).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageFamilyCareLeaves(makeTestSession("admin"))).toBe(true)
  })

  test("manager cannot manage", () => {
    expect(canManageFamilyCareLeaves(makeTestSession("manager"))).toBe(false)
  })

  test("member cannot manage", () => {
    expect(canManageFamilyCareLeaves(makeTestSession("member"))).toBe(false)
  })
})
