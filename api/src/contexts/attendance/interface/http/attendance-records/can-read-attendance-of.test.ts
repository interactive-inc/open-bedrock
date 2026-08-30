import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { canReadAttendanceOf } from "@/contexts/attendance/interface/http/attendance-records/can-read-attendance-of"
import type { EmployeeRelation } from "@/contexts/company/domain/definitions/employee-relation.definition"
import { makeTestSession } from "@tests/api/support/make-test-session"
import { testAccountId } from "@tests/api/support/test-account-id"
import { describe, expect, test } from "bun:test"

const self: EmployeeRelation = { isSelf: true, isReport: false, isSameDepartment: false }

const report: EmployeeRelation = { isSelf: false, isReport: true, isSameDepartment: false }

const sameDept: EmployeeRelation = { isSelf: false, isReport: false, isSameDepartment: true }

const stranger: EmployeeRelation = { isSelf: false, isReport: false, isSameDepartment: false }

function sessionWith(permissions: ReadonlyArray<string>): CompanySessionValue {
  return new CompanySessionValue({
    accountId: testAccountId(1),
    employeeId: toWorkforceEmployeeId(1),
    employmentStatus: "ACTIVE",
    permissions: new Set(permissions),
    roleKeys: [],
  })
}

describe("canReadAttendanceOf", () => {
  test("self is always allowed", () => {
    expect(canReadAttendanceOf(makeTestSession("member"), self)).toBe(true)
  })

  test("hr (attendance:read:all) reads a stranger", () => {
    expect(canReadAttendanceOf(makeTestSession("hr"), stranger)).toBe(true)
  })

  test("manager (attendance:read:reports) reads a report", () => {
    expect(canReadAttendanceOf(makeTestSession("manager"), report)).toBe(true)
  })

  test("manager cannot read a stranger", () => {
    expect(canReadAttendanceOf(makeTestSession("manager"), stranger)).toBe(false)
  })

  test("manager cannot read a same-department non-report", () => {
    expect(canReadAttendanceOf(makeTestSession("manager"), sameDept)).toBe(false)
  })

  test("attendance:read:department holder reads same department only", () => {
    const session = sessionWith(["attendance:read:department"])

    expect(canReadAttendanceOf(session, sameDept)).toBe(true)
    expect(canReadAttendanceOf(session, report)).toBe(false)
    expect(canReadAttendanceOf(session, stranger)).toBe(false)
  })
})
