import { canManageBusinessTrips } from "@/lib/business-trip/can-manage-business-trips"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canManageBusinessTrips", () => {
  test("hr can manage", () => {
    expect(canManageBusinessTrips(makeTestSession("hr"))).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageBusinessTrips(makeTestSession("admin"))).toBe(true)
  })

  test("manager cannot manage", () => {
    expect(canManageBusinessTrips(makeTestSession("manager"))).toBe(false)
  })

  test("member cannot manage", () => {
    expect(canManageBusinessTrips(makeTestSession("member"))).toBe(false)
  })
})
