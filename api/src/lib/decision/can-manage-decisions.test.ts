import { canManageDecisions } from "@/lib/decision/can-manage-decisions"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canManageDecisions", () => {
  test("admin can manage", () => {
    expect(canManageDecisions(makeTestSession("admin"))).toBe(true)
  })

  test("member cannot manage", () => {
    expect(canManageDecisions(makeTestSession("member"))).toBe(false)
  })

  test("manager cannot manage", () => {
    expect(canManageDecisions(makeTestSession("manager"))).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManageDecisions(makeTestSession("unknown"))).toBe(false)
  })
})
