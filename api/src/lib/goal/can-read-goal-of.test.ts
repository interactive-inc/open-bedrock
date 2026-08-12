import { Session } from "@/contexts/company/domain/iam/session"
import { canReadGoalOf } from "@/lib/goal/can-read-goal-of"
import type { EmployeeRelation } from "@/lib/org/employee-relation"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

function sessionWith(permissions: ReadonlyArray<string>): Session {
  return new Session({
    accountId: 1,
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
    expect(canReadGoalOf(makeTestSession("member"), self)).toBe(true)
  })

  test("hr (goal:read:all) reads a stranger", () => {
    expect(canReadGoalOf(makeTestSession("hr"), stranger)).toBe(true)
  })

  test("manager (goal:read:reports) reads a report", () => {
    expect(canReadGoalOf(makeTestSession("manager"), report)).toBe(true)
  })

  test("manager cannot read a stranger", () => {
    expect(canReadGoalOf(makeTestSession("manager"), stranger)).toBe(false)
  })

  test("manager cannot read a same-department non-report (no department key)", () => {
    expect(canReadGoalOf(makeTestSession("manager"), sameDept)).toBe(false)
  })

  test("member cannot read a report", () => {
    expect(canReadGoalOf(makeTestSession("member"), report)).toBe(false)
  })

  test("goal:read:department holder reads same department only", () => {
    const session = sessionWith(["goal:read:department"])

    expect(canReadGoalOf(session, sameDept)).toBe(true)
    expect(canReadGoalOf(session, report)).toBe(false)
    expect(canReadGoalOf(session, stranger)).toBe(false)
  })
})
