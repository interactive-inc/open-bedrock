import { describe, expect, test } from "bun:test"
import { projectPersonnelAction } from "@/contexts/company/domain/policies/project-personnel-action.policy"
import { personnelActionInputSchema } from "@/contexts/company/domain/definitions/lifecycle-types.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"

function project(initialStatus: "active" | "retired", employmentType: "PART_TIME" | null) {
  const employeeId = restoreWorkforceId("employee", "employee:initial")
  return projectPersonnelAction({
    schedule: { employments: [], statuses: [], assignments: [], responsibilities: [] },
    organizationSchedules: [],
    departments: [],
    employees: [{ id: employeeId, code: "INITIAL" }],
    command: {
      actionId: crypto.randomUUID(),
      employeeId,
      recordedAt: 100,
      input: personnelActionInputSchema.parse({
        kind: "initial_state",
        employeeCode: "INITIAL",
        eventOn: "2026-01-01",
        initialStatus,
        employmentType,
        departmentCode: null,
        positionTitle: null,
        managerEmployeeCode: null,
      }),
    },
  })
}
describe("初期状態の雇用区分", () => {
  test("有効な初期雇用には区分を要求し、その区分で契約を作る", () => {
    expect(project("active", null)).toMatchObject({ code: "personnel_action_invalid_transition" })
    const projected = project("active", "PART_TIME")
    if (projected instanceof Error) throw projected
    expect(projected.newEmploymentType).toBe("PART_TIME")
    expect(projected.schedule.employments).toHaveLength(1)
  })
  test("既に退職した初期状態では区分を捏造せず、契約を作らない", () => {
    const projected = project("retired", null)
    if (projected instanceof Error) throw projected
    expect(projected.newEmploymentType).toBeNull()
    expect(projected.schedule.employments).toHaveLength(0)
    expect(projected.mutations).toHaveLength(0)
  })
})
