import { describe, expect, test } from "bun:test"
import { canWriteCompanyGoal } from "@/lib/goal/can-write-company-goal"
import { makeTestSession } from "@/interface/shared/test/make-test-session"

describe("canWriteCompanyGoal", () => {
  test("allows review administrators (manager/hr/admin)", () => {
    expect(canWriteCompanyGoal(makeTestSession("manager"))).toBe(true)
    expect(canWriteCompanyGoal(makeTestSession("admin"))).toBe(true)
  })

  test("denies plain members", () => {
    expect(canWriteCompanyGoal(makeTestSession("member"))).toBe(false)
  })
})
