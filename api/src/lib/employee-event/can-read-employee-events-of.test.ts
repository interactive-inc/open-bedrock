import { canReadEmployeeEventsOf } from "@/lib/employee-event/can-read-employee-events-of"
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

const stranger: EmployeeRelation = { isSelf: false, isReport: false, isSameDepartment: false }

describe("canReadEmployeeEventsOf", () => {
  test("self is always allowed", () => {
    expect(canReadEmployeeEventsOf(sessionWith([]), self)).toBe(true)
  })

  test("employee_event:read:all reads a stranger", () => {
    expect(canReadEmployeeEventsOf(sessionWith(["employee_event:read:all"]), stranger)).toBe(true)
  })

  test("no read:all cannot read a report (no reports scope for events)", () => {
    expect(canReadEmployeeEventsOf(sessionWith([]), report)).toBe(false)
  })
})
