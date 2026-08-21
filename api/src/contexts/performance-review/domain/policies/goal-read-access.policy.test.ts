import { Session } from "@/lib/auth/session"
import { canReadGoalOf } from "@/contexts/performance-review/domain/policies/goal-read-access.policy"
import type { EmployeeRelation } from "@/contexts/company/domain/values/employee-relation.definition"
import { describe, expect, test } from "bun:test"
import { testAccountId } from "@/api/test/support/test-account-id"

function sessionWith(permissions: ReadonlyArray<string>): Session {
  return new Session({
    accountId: testAccountId(1),
    employeeId: 1,
    employeeStatus: "active",
    permissions: new Set(permissions),
    roleKeys: [],
  })
}

const self: EmployeeRelation = { isSelf: true, isReport: false, isSameDepartment: false }

const report: EmployeeRelation = { isSelf: false, isReport: true, isSameDepartment: false }

const sameDept: EmployeeRelation = { isSelf: false, isReport: false, isSameDepartment: true }

const stranger: EmployeeRelation = { isSelf: false, isReport: false, isSameDepartment: false }

describe("canReadGoalOf", () => {
  test("self is always allowed", () => {
    expect(canReadGoalOf(sessionWith([]), self)).toBe(true)
  })

  test("hr (goal:read:all) reads a stranger", () => {
    expect(canReadGoalOf(sessionWith(["goal:read:all"]), stranger)).toBe(true)
  })

  test("manager (goal:read:reports) reads a report", () => {
    expect(canReadGoalOf(sessionWith(["goal:read:reports"]), report)).toBe(true)
  })

  test("manager cannot read a stranger", () => {
    expect(canReadGoalOf(sessionWith(["goal:read:reports"]), stranger)).toBe(false)
  })

  test("manager cannot read a same-department non-report (no department key)", () => {
    expect(canReadGoalOf(sessionWith(["goal:read:reports"]), sameDept)).toBe(false)
  })

  test("member cannot read a report", () => {
    expect(canReadGoalOf(sessionWith([]), report)).toBe(false)
  })

  test("goal:read:department holder reads same department only", () => {
    const session = sessionWith(["goal:read:department"])

    expect(canReadGoalOf(session, sameDept)).toBe(true)
    expect(canReadGoalOf(session, report)).toBe(false)
    expect(canReadGoalOf(session, stranger)).toBe(false)
  })
})
