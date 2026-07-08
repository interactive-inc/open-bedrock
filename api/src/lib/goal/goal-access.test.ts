import { canEvaluateAsManager, canViewOthers } from "@/lib/goal/goal-access"
import type { SessionPayload } from "@/env"
import { describe, expect, test } from "bun:test"

function makeSession(permissions: ReadonlyArray<string>): SessionPayload {
  return {
    accountId: 1,
    employeeId: 1,
    employeeStatus: "active",
    permissions: new Set(permissions),
    roleKeys: [],
    role: "",
  }
}

describe("canViewOthers", () => {
  test("returns true when session has goal:read:all", () => {
    expect(canViewOthers(makeSession(["goal:read:all"]))).toBe(true)
  })

  test("returns false when session lacks goal:read:all", () => {
    expect(canViewOthers(makeSession([]))).toBe(false)
  })

  test("returns false when session has unrelated permissions", () => {
    expect(canViewOthers(makeSession(["employee:read"]))).toBe(false)
  })
})

describe("canEvaluateAsManager", () => {
  test("returns true when session has goal:evaluate", () => {
    expect(canEvaluateAsManager(makeSession(["goal:evaluate"]))).toBe(true)
  })

  test("returns false when session lacks goal:evaluate", () => {
    expect(canEvaluateAsManager(makeSession([]))).toBe(false)
  })

  test("returns false when session has unrelated permissions", () => {
    expect(canEvaluateAsManager(makeSession(["goal:read:all"]))).toBe(false)
  })
})
