import { canEvaluateGoalOf } from "@/contexts/company/application/goal/can-evaluate-goal-of"
import type { EmployeeRelation } from "@/contexts/company/domain/organization/employee-relation"
import { makeTestSession } from "@/contexts/company/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

const report: EmployeeRelation = { isSelf: false, isReport: true, isSameDepartment: false }

const sameDept: EmployeeRelation = { isSelf: false, isReport: false, isSameDepartment: true }

const stranger: EmployeeRelation = { isSelf: false, isReport: false, isSameDepartment: false }

const self: EmployeeRelation = { isSelf: true, isReport: false, isSameDepartment: false }

describe("canEvaluateGoalOf", () => {
  test("hr (goal:evaluate) evaluates a stranger", () => {
    expect(canEvaluateGoalOf(makeTestSession("hr"), stranger)).toBe(true)
  })

  test("manager (goal:evaluate:reports) evaluates a report", () => {
    expect(canEvaluateGoalOf(makeTestSession("manager"), report)).toBe(true)
  })

  test("manager cannot evaluate a stranger", () => {
    expect(canEvaluateGoalOf(makeTestSession("manager"), stranger)).toBe(false)
  })

  test("manager cannot evaluate a same-department non-report", () => {
    expect(canEvaluateGoalOf(makeTestSession("manager"), sameDept)).toBe(false)
  })

  test("self relation alone does not grant evaluation", () => {
    expect(canEvaluateGoalOf(makeTestSession("member"), self)).toBe(false)
  })
})
