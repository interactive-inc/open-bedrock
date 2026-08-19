import { Session } from "@/contexts/company/domain/iam/session"
import { describe, expect, test } from "bun:test"
import { testAccountId } from "@/api/test/support/test-account-id"

function makeSession(permissions: ReadonlyArray<string>): Session {
  return new Session({
    accountId: testAccountId(1),
    employeeId: 1,
    employeeStatus: "active",
    permissions: new Set(permissions),
    roleKeys: ["custom"],
  })
}

describe("employee permissions", () => {
  test("employee:create grants registration only", () => {
    const session = makeSession(["employee:create"])

    expect(session.hasPermission("employee:create")).toBe(true)
    expect(session.hasPermission("employee:update")).toBe(false)
  })

  test("employee:update grants updates only", () => {
    const session = makeSession(["employee:update"])

    expect(session.hasPermission("employee:create")).toBe(false)
    expect(session.hasPermission("employee:update")).toBe(true)
  })

  test("employee:read is independent from write permissions", () => {
    const readSession = makeSession(["employee:read"])

    expect(readSession.hasPermission("employee:read")).toBe(true)
    expect(readSession.hasPermission("employee:create")).toBe(false)
    expect(readSession.hasPermission("employee:update")).toBe(false)
  })
})
