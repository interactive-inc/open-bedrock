import { resolveEvaluationPermission } from "@/lib/goal/resolve-evaluation-permission"
import { makeTestSession } from "@/interface/shared/test/make-test-session"
import { describe, expect, test } from "bun:test"

describe("resolveEvaluationPermission", () => {
  test("self kind: owner returns null (allowed)", () => {
    const permission = resolveEvaluationPermission({
      kind: "self",
      goalEmployeeId: 10,
      viewerEmployeeId: 10,
      session: makeTestSession("member", 10),
    })

    expect(permission).toBe(null)
  })

  test("self kind: non-owner returns forbidden", () => {
    const permission = resolveEvaluationPermission({
      kind: "self",
      goalEmployeeId: 10,
      viewerEmployeeId: 20,
      session: makeTestSession("member", 20),
    })

    expect(permission).toEqual({ reason: "forbidden" })
  })

  test("manager kind: manager session returns null", () => {
    const permission = resolveEvaluationPermission({
      kind: "manager",
      goalEmployeeId: 10,
      viewerEmployeeId: 20,
      session: makeTestSession("manager", 20),
    })

    expect(permission).toBe(null)
  })

  test("manager kind: hr session returns null", () => {
    const permission = resolveEvaluationPermission({
      kind: "manager",
      goalEmployeeId: 10,
      viewerEmployeeId: 20,
      session: makeTestSession("hr", 20),
    })

    expect(permission).toBe(null)
  })

  test("manager kind: admin session returns null", () => {
    const permission = resolveEvaluationPermission({
      kind: "manager",
      goalEmployeeId: 10,
      viewerEmployeeId: 20,
      session: makeTestSession("admin", 20),
    })

    expect(permission).toBe(null)
  })

  test("manager kind: member session returns forbidden", () => {
    const permission = resolveEvaluationPermission({
      kind: "manager",
      goalEmployeeId: 10,
      viewerEmployeeId: 20,
      session: makeTestSession("member", 20),
    })

    expect(permission).toEqual({ reason: "forbidden" })
  })

  test("final kind: manager session returns null", () => {
    const permission = resolveEvaluationPermission({
      kind: "final",
      goalEmployeeId: 10,
      viewerEmployeeId: 20,
      session: makeTestSession("manager", 20),
    })

    expect(permission).toBe(null)
  })

  test("final kind: member session returns forbidden", () => {
    const permission = resolveEvaluationPermission({
      kind: "final",
      goalEmployeeId: 10,
      viewerEmployeeId: 20,
      session: makeTestSession("member", 20),
    })

    expect(permission).toEqual({ reason: "forbidden" })
  })
})
