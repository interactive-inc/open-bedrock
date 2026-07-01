import { canViewAllRedemptions } from "@/lib/thanks-points/can-view-all-redemptions"
import { makeTestSession } from "@/interface/shared/test/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canViewAllRedemptions", () => {
  test("admin can view all", () => {
    expect(canViewAllRedemptions(makeTestSession("admin"))).toBe(true)
  })

  test("hr can view all", () => {
    expect(canViewAllRedemptions(makeTestSession("hr"))).toBe(true)
  })

  test("manager cannot view all", () => {
    expect(canViewAllRedemptions(makeTestSession("manager"))).toBe(false)
  })

  test("member cannot view all", () => {
    expect(canViewAllRedemptions(makeTestSession("member"))).toBe(false)
  })
})
