import { Session } from "@/contexts/company/domain/iam/session"
import { canReadLeaveOf } from "@/contexts/company/interface/routes/leave-requests/can-read-leave-of"
import type { EmployeeRelation } from "@/contexts/company/domain/organization/employee-relation"
import { makeTestSession } from "@/contexts/company/interface/test-helpers/make-test-session"
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

describe("canReadLeaveOf", () => {
  test("self is always allowed", () => {
    expect(canReadLeaveOf(makeTestSession("member"), self)).toBe(true)
  })

  test("hr (leave:read:all) reads a stranger", () => {
    expect(canReadLeaveOf(makeTestSession("hr"), stranger)).toBe(true)
  })

  test("manager (leave:read:reports) reads a report", () => {
    expect(canReadLeaveOf(makeTestSession("manager"), report)).toBe(true)
  })

  test("manager cannot read a stranger", () => {
    expect(canReadLeaveOf(makeTestSession("manager"), stranger)).toBe(false)
  })

  test("manager cannot read a same-department non-report (no department key)", () => {
    expect(canReadLeaveOf(makeTestSession("manager"), sameDept)).toBe(false)
  })

  test("member cannot read a report", () => {
    expect(canReadLeaveOf(makeTestSession("member"), report)).toBe(false)
  })

  test("leave:read:department holder reads same department only", () => {
    const session = sessionWith(["leave:read:department"])

    expect(canReadLeaveOf(session, sameDept)).toBe(true)
    expect(canReadLeaveOf(session, report)).toBe(false)
    expect(canReadLeaveOf(session, stranger)).toBe(false)
  })
})
