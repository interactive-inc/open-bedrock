import { Session } from "@/contexts/company-compatibility/domain/iam/session"
import { canReadGradeOf } from "@/contexts/company-compatibility/interface/routes/employee-grades/can-read-grade-of"
import type { EmployeeRelation } from "@/contexts/company-compatibility/domain/organization/employee-relation"
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

describe("canReadGradeOf", () => {
  test("self is always allowed", () => {
    expect(canReadGradeOf(sessionWith([]), self)).toBe(true)
  })

  test("grade:read:all reads a stranger", () => {
    expect(canReadGradeOf(sessionWith(["grade:read:all"]), stranger)).toBe(true)
  })

  test("grade:read:reports reads a report", () => {
    expect(canReadGradeOf(sessionWith(["grade:read:reports"]), report)).toBe(true)
  })

  test("grade:read:reports cannot read a stranger", () => {
    expect(canReadGradeOf(sessionWith(["grade:read:reports"]), stranger)).toBe(false)
  })

  test("grade:read:reports cannot read a same-department non-report", () => {
    expect(canReadGradeOf(sessionWith(["grade:read:reports"]), sameDept)).toBe(false)
  })

  test("no permission cannot read a report", () => {
    expect(canReadGradeOf(sessionWith([]), report)).toBe(false)
  })
})
