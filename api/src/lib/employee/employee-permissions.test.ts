import { canCreateEmployee } from "@/lib/employee/can-create-employee"
import { canUpdateEmployee } from "@/lib/employee/can-update-employee"
import { canReadEmployees } from "@/lib/employee/can-read-employees"
import type { SessionPayload } from "@/env"
import { describe, expect, test } from "bun:test"

function makeSession(permissions: ReadonlyArray<string>): SessionPayload {
  return {
    accountId: 1,
    employeeId: 1,
    employeeStatus: "active",
    permissions: new Set(permissions),
    roleKeys: ["custom"],
    role: "member",
  }
}

describe("employee permissions", () => {
  test("employee:create grants registration only", () => {
    const session = makeSession(["employee:create"])

    expect(canCreateEmployee(session)).toBe(true)
    expect(canUpdateEmployee(session)).toBe(false)
  })

  test("employee:update grants updates only", () => {
    const session = makeSession(["employee:update"])

    expect(canCreateEmployee(session)).toBe(false)
    expect(canUpdateEmployee(session)).toBe(true)
  })

  test("employee:read is independent from write permissions", () => {
    const readSession = makeSession(["employee:read"])

    expect(canReadEmployees(readSession)).toBe(true)
    expect(canCreateEmployee(readSession)).toBe(false)
    expect(canUpdateEmployee(readSession)).toBe(false)
  })
})
