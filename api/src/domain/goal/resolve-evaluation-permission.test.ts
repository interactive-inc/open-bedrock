import { resolveEvaluationPermission } from "@/domain/goal/resolve-evaluation-permission"
import { describe, expect, test } from "bun:test"

describe("resolveEvaluationPermission", () => {
  test("self kind: owner returns null (allowed)", () => {
    const permission = resolveEvaluationPermission({
      kind: "self",
      goalEmployeeId: 10,
      viewerEmployeeId: 10,
      viewerRole: "member",
    })

    expect(permission).toBe(null)
  })

  test("self kind: non-owner returns forbidden", () => {
    const permission = resolveEvaluationPermission({
      kind: "self",
      goalEmployeeId: 10,
      viewerEmployeeId: 20,
      viewerRole: "member",
    })

    expect(permission).toEqual({ reason: "forbidden" })
  })

  test("manager kind: manager role returns null", () => {
    const permission = resolveEvaluationPermission({
      kind: "manager",
      goalEmployeeId: 10,
      viewerEmployeeId: 20,
      viewerRole: "manager",
    })

    expect(permission).toBe(null)
  })

  test("manager kind: hr role returns null", () => {
    const permission = resolveEvaluationPermission({
      kind: "manager",
      goalEmployeeId: 10,
      viewerEmployeeId: 20,
      viewerRole: "hr",
    })

    expect(permission).toBe(null)
  })

  test("manager kind: admin role returns null", () => {
    const permission = resolveEvaluationPermission({
      kind: "manager",
      goalEmployeeId: 10,
      viewerEmployeeId: 20,
      viewerRole: "admin",
    })

    expect(permission).toBe(null)
  })

  test("manager kind: member role returns forbidden", () => {
    const permission = resolveEvaluationPermission({
      kind: "manager",
      goalEmployeeId: 10,
      viewerEmployeeId: 20,
      viewerRole: "member",
    })

    expect(permission).toEqual({ reason: "forbidden" })
  })

  test("final kind: manager role returns null", () => {
    const permission = resolveEvaluationPermission({
      kind: "final",
      goalEmployeeId: 10,
      viewerEmployeeId: 20,
      viewerRole: "manager",
    })

    expect(permission).toBe(null)
  })

  test("final kind: member role returns forbidden", () => {
    const permission = resolveEvaluationPermission({
      kind: "final",
      goalEmployeeId: 10,
      viewerEmployeeId: 20,
      viewerRole: "member",
    })

    expect(permission).toEqual({ reason: "forbidden" })
  })
})
