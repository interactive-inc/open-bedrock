import { describe, expect, test } from "bun:test"
import { canWriteCompanyGoal } from "@/lib/goal/can-write-company-goal"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"

describe("canWriteCompanyGoal", () => {
  test("allows review administrators (hr/admin)", () => {
    expect(canWriteCompanyGoal(makeTestSession("hr"))).toBe(true)
    expect(canWriteCompanyGoal(makeTestSession("admin"))).toBe(true)
  })

  test("denies plain members and managers without review:administer", () => {
    expect(canWriteCompanyGoal(makeTestSession("member"))).toBe(false)
    expect(canWriteCompanyGoal(makeTestSession("manager"))).toBe(false)
  })
})
