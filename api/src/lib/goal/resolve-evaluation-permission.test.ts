import { resolveEvaluationPermission } from "@/lib/goal/resolve-evaluation-permission"
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

describe("resolveEvaluationPermission", () => {
  test("self kind: owner returns null (allowed)", () => {
    const permission = resolveEvaluationPermission({
      kind: "self",
      goalEmployeeId: 10,
      viewerEmployeeId: 10,
      viewerSession: makeSession([]),
    })

    expect(permission).toBe(null)
  })

  test("self kind: non-owner returns forbidden", () => {
    const permission = resolveEvaluationPermission({
      kind: "self",
      goalEmployeeId: 10,
      viewerEmployeeId: 20,
      viewerSession: makeSession([]),
    })

    expect(permission).toEqual({ reason: "forbidden" })
  })

  test("manager kind: session with goal:evaluate returns null", () => {
    const permission = resolveEvaluationPermission({
      kind: "manager",
      goalEmployeeId: 10,
      viewerEmployeeId: 20,
      viewerSession: makeSession(["goal:evaluate"]),
    })

    expect(permission).toBe(null)
  })

  test("manager kind: session without goal:evaluate returns forbidden", () => {
    const permission = resolveEvaluationPermission({
      kind: "manager",
      goalEmployeeId: 10,
      viewerEmployeeId: 20,
      viewerSession: makeSession([]),
    })

    expect(permission).toEqual({ reason: "forbidden" })
  })

  test("manager kind: owner cannot evaluate their own goal", () => {
    const permission = resolveEvaluationPermission({
      kind: "manager",
      goalEmployeeId: 10,
      viewerEmployeeId: 10,
      viewerSession: makeSession(["goal:evaluate"]),
    })

    expect(permission).toEqual({ reason: "forbidden" })
  })

  test("final kind: session with goal:evaluate returns null", () => {
    const permission = resolveEvaluationPermission({
      kind: "final",
      goalEmployeeId: 10,
      viewerEmployeeId: 20,
      viewerSession: makeSession(["goal:evaluate"]),
    })

    expect(permission).toBe(null)
  })

  test("final kind: session without goal:evaluate returns forbidden", () => {
    const permission = resolveEvaluationPermission({
      kind: "final",
      goalEmployeeId: 10,
      viewerEmployeeId: 20,
      viewerSession: makeSession([]),
    })

    expect(permission).toEqual({ reason: "forbidden" })
  })

  test("final kind: owner cannot finalize their own goal", () => {
    const permission = resolveEvaluationPermission({
      kind: "final",
      goalEmployeeId: 10,
      viewerEmployeeId: 10,
      viewerSession: makeSession(["goal:evaluate"]),
    })

    expect(permission).toEqual({ reason: "forbidden" })
  })
})
