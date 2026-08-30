import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { describe, expect, test } from "bun:test"
import { canWriteDepartmentGoal } from "@/contexts/performance-review/interface/http/performance-goals/can-write-department-goal"
import { makeTestSession } from "@tests/api/support/make-test-session"
import { testAccountId } from "@tests/api/support/test-account-id"

/**
 * review:administer を持たず goal:evaluate:reports だけを持つマネージャー相当のセッション。
 * system role の manager は review:administer も持つため、部門スコープの限定を確かめるには
 * この最小権限セッションを使う。
 */
function reportsManagerSession(): CompanySessionValue {
  return new CompanySessionValue({
    accountId: testAccountId(1),
    employeeId: toWorkforceEmployeeId(1),
    employmentStatus: "ACTIVE",
    permissions: new Set<string>(["goal:evaluate:reports"]),
    roleKeys: ["custom"],
  })
}

describe("canWriteDepartmentGoal", () => {
  test("review administrator can write any department goal", () => {
    // admin/hr は review:administer を持つので所属に関係なく許可。
    const result = canWriteDepartmentGoal({
      session: makeTestSession("root"),
      departmentCode: "D003",
      viewerDepartmentCode: "D001",
    })

    expect(result).toBe(true)
  })

  test("reports manager can write a goal for their own department", () => {
    const result = canWriteDepartmentGoal({
      session: reportsManagerSession(),
      departmentCode: "D003",
      viewerDepartmentCode: "D003",
    })

    expect(result).toBe(true)
  })

  test("reports manager cannot write a goal for another department", () => {
    const result = canWriteDepartmentGoal({
      session: reportsManagerSession(),
      departmentCode: "D004",
      viewerDepartmentCode: "D003",
    })

    expect(result).toBe(false)
  })

  test("member cannot write a department goal", () => {
    const result = canWriteDepartmentGoal({
      session: makeTestSession("member"),
      departmentCode: "D003",
      viewerDepartmentCode: "D003",
    })

    expect(result).toBe(false)
  })
})
