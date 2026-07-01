import { canViewAllLeaves } from "@/lib/leave/can-view-all-leaves"
import { makeTestSession } from "@/interface/shared/test/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canViewAllLeaves", () => {
  test("admin can view all", () => {
    expect(canViewAllLeaves(makeTestSession("admin"))).toBe(true)
  })

  test("hr can view all", () => {
    expect(canViewAllLeaves(makeTestSession("hr"))).toBe(true)
  })

  test("manager cannot view all", () => {
    expect(canViewAllLeaves(makeTestSession("manager"))).toBe(false)
  })

  test("member cannot view all", () => {
    expect(canViewAllLeaves(makeTestSession("member"))).toBe(false)
  })
})
