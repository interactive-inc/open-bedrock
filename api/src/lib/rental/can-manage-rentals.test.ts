import { canManageRentals } from "@/lib/rental/can-manage-rentals"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canManageRentals", () => {
  test("hr can manage", () => {
    expect(canManageRentals(makeTestSession("hr"))).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageRentals(makeTestSession("admin"))).toBe(true)
  })

  test("manager cannot manage", () => {
    expect(canManageRentals(makeTestSession("manager"))).toBe(false)
  })

  test("member cannot manage", () => {
    expect(canManageRentals(makeTestSession("member"))).toBe(false)
  })
})
