import { resolveEvaluationPermission } from "@/application/goal/resolve-evaluation-permission"
import type { EmployeeRelation } from "@/lib/org/employee-relation"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

const noRelation: EmployeeRelation = { isSelf: false, isReport: false, isSameDepartment: false }

const reportRelation: EmployeeRelation = { isSelf: false, isReport: true, isSameDepartment: false }

describe("resolveEvaluationPermission", () => {
  test("self kind: owner returns null (allowed)", () => {
    const permission = resolveEvaluationPermission({
      kind: "self",
      goalEmployeeId: 10,
      viewerEmployeeId: 10,
      session: makeTestSession("member", 10),
      relation: noRelation,
    })

    expect(permission).toBe(null)
  })

  test("self kind: non-owner returns forbidden", () => {
    const permission = resolveEvaluationPermission({
      kind: "self",
      goalEmployeeId: 10,
      viewerEmployeeId: 20,
      session: makeTestSession("member", 20),
      relation: noRelation,
    })

    expect(permission).toEqual({ reason: "forbidden" })
  })

  test("manager kind: manager evaluating a report returns null", () => {
    const permission = resolveEvaluationPermission({
      kind: "manager",
      goalEmployeeId: 10,
      viewerEmployeeId: 20,
      session: makeTestSession("manager", 20),
      relation: reportRelation,
    })

    expect(permission).toBe(null)
  })

  test("manager kind: manager evaluating a non-report returns forbidden", () => {
    const permission = resolveEvaluationPermission({
      kind: "manager",
      goalEmployeeId: 10,
      viewerEmployeeId: 20,
      session: makeTestSession("manager", 20),
      relation: noRelation,
    })

    expect(permission).toEqual({ reason: "forbidden" })
  })

  test("manager kind: hr (goal:evaluate) returns null regardless of relation", () => {
    const permission = resolveEvaluationPermission({
      kind: "manager",
      goalEmployeeId: 10,
      viewerEmployeeId: 20,
      session: makeTestSession("hr", 20),
      relation: noRelation,
    })

    expect(permission).toBe(null)
  })

  test("manager kind: admin returns null regardless of relation", () => {
    const permission = resolveEvaluationPermission({
      kind: "manager",
      goalEmployeeId: 10,
      viewerEmployeeId: 20,
      session: makeTestSession("admin", 20),
      relation: noRelation,
    })

    expect(permission).toBe(null)
  })

  test("manager kind: member session returns forbidden", () => {
    const permission = resolveEvaluationPermission({
      kind: "manager",
      goalEmployeeId: 10,
      viewerEmployeeId: 20,
      session: makeTestSession("member", 20),
      relation: reportRelation,
    })

    expect(permission).toEqual({ reason: "forbidden" })
  })

  test("final kind: manager evaluating a report returns null", () => {
    const permission = resolveEvaluationPermission({
      kind: "final",
      goalEmployeeId: 10,
      viewerEmployeeId: 20,
      session: makeTestSession("manager", 20),
      relation: reportRelation,
    })

    expect(permission).toBe(null)
  })

  test("final kind: member session returns forbidden", () => {
    const permission = resolveEvaluationPermission({
      kind: "final",
      goalEmployeeId: 10,
      viewerEmployeeId: 20,
      session: makeTestSession("member", 20),
      relation: reportRelation,
    })

    expect(permission).toEqual({ reason: "forbidden" })
  })

  test("manager kind: owner cannot evaluate their own goal even with goal:evaluate", () => {
    const permission = resolveEvaluationPermission({
      kind: "manager",
      goalEmployeeId: 10,
      viewerEmployeeId: 10,
      session: makeTestSession("admin", 10),
      relation: noRelation,
    })

    expect(permission).toEqual({ reason: "forbidden" })
  })

  test("final kind: owner cannot finalize their own goal even with goal:evaluate", () => {
    const permission = resolveEvaluationPermission({
      kind: "final",
      goalEmployeeId: 10,
      viewerEmployeeId: 10,
      session: makeTestSession("admin", 10),
      relation: noRelation,
    })

    expect(permission).toEqual({ reason: "forbidden" })
  })
})
