import { canReadGradeOf } from "@/lib/grade/can-read-grade-of"
import type { EmployeeRelation } from "@/lib/org/employee-relation"
import type { SessionPayload } from "@/env"
import { describe, expect, test } from "bun:test"

function sessionWith(permissions: ReadonlyArray<string>): SessionPayload {
  return {
    accountId: 1,
    employeeId: 1,
    employeeStatus: "active",
    permissions: new Set(permissions),
    roleKeys: [],
  }
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
