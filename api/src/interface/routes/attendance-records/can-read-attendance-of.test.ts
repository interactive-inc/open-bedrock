import { Session } from "@/domain/company/iam/session"
import { canReadAttendanceOf } from "@/interface/routes/attendance-records/can-read-attendance-of"
import type { EmployeeRelation } from "@/lib/org/employee-relation"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

const self: EmployeeRelation = { isSelf: true, isReport: false, isSameDepartment: false }

const report: EmployeeRelation = { isSelf: false, isReport: true, isSameDepartment: false }

const sameDept: EmployeeRelation = { isSelf: false, isReport: false, isSameDepartment: true }

const stranger: EmployeeRelation = { isSelf: false, isReport: false, isSameDepartment: false }

function sessionWith(permissions: ReadonlyArray<string>): Session {
  return new Session({
    accountId: 1,
    employeeId: 1,
    employeeStatus: "active",
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
