import {
  LIFECYCLE_ERROR_CODES,
  lifecycleEmployeeStatusSchema,
  personnelActionInputSchema,
  personnelActionKindSchema,
} from "@/contexts/company/domain/employee-lifecycle/lifecycle-types"
import { describe, expect, test } from "bun:test"

const actionInputs: ReadonlyArray<unknown> = [
  {
    kind: "hire",
    employeeCode: "E100",
    employeeName: "テスト従業員",
    eventOn: "2026-04-01",
    departmentCode: "D001",
    positionTitle: "Member",
    managerEmployeeCode: "E001",
  },
  {
    kind: "rehire",
    employeeCode: "E100",
    eventOn: "2027-04-01",
    departmentCode: "D001",
    positionTitle: null,
    managerEmployeeCode: null,
  },
  {
    kind: "primary_assignment_started",
    employeeCode: "E100",
    eventOn: "2026-04-01",
    departmentCode: "D001",
    positionTitle: null,
    managerEmployeeCode: null,
  },
  {
    kind: "transferred",
    employeeCode: "E100",
    eventOn: "2026-10-01",
    departmentCode: "D002",
    positionTitle: "Lead",
    managerEmployeeCode: "E002",
  },
  {
    kind: "concurrent_assignment_started",
    employeeCode: "E100",
    eventOn: "2026-05-01",
    departmentCode: "D003",
    positionTitle: null,
    managerEmployeeCode: null,
  },
  {
    kind: "assignment_ended",
    employeeCode: "E100",
    eventOn: "2026-08-01",
    departmentCode: "D003",
    assignmentType: "concurrent",
  },
  {
    kind: "position_changed",
    employeeCode: "E100",
    eventOn: "2026-07-01",
    departmentCode: "D001",
    assignmentType: "primary",
    positionTitle: "Lead",
    changeType: "promotion",
  },
  {
    kind: "manager_changed",
    employeeCode: "E100",
    eventOn: "2026-07-01",
    departmentCode: "D001",
    assignmentType: "primary",
    managerEmployeeCode: "E002",
  },
  {
    kind: "department_responsibility_started",
    employeeCode: "E100",
    eventOn: "2026-07-01",
    departmentCode: "D001",
  },
  {
    kind: "department_responsibility_ended",
    employeeCode: "E100",
    eventOn: "2026-12-01",
    departmentCode: "D001",
  },
  { kind: "leave_started", employeeCode: "E100", eventOn: "2026-09-01" },
  { kind: "returned", employeeCode: "E100", eventOn: "2026-10-01" },
  { kind: "retired", employeeCode: "E100", retirementOn: "2027-03-31" },
  {
    kind: "corrected",
    eventOn: "2026-07-02",
    correctsActionId: "00000000-0000-4000-8000-000000000001",
    reason: "入力誤りの訂正",
    replacementAction: {
      kind: "manager_changed",
      employeeCode: "E100",
      eventOn: "2026-07-01",
      departmentCode: "D001",
      assignmentType: "primary",
      managerEmployeeCode: "E003",
    },
  },
  {
    kind: "legacy_baseline",
    employeeCode: "E100",
    eventOn: "2026-01-01",
    legacyStatus: "active",
    departmentCode: "D001",
    positionTitle: null,
    managerEmployeeCode: null,
  },
]

describe("lifecycle vocabulary", () => {
  test("keeps the exact derived employee status vocabulary", () => {
    expect(lifecycleEmployeeStatusSchema.options).toEqual(["prehire", "active", "leave", "retired"])
  })

  test("keeps the exact personnel action vocabulary", () => {
    expect(personnelActionKindSchema.options).toEqual([
      "hire",
      "rehire",
      "primary_assignment_started",
      "transferred",
      "concurrent_assignment_started",
      "assignment_ended",
      "position_changed",
      "manager_changed",
      "department_responsibility_started",
      "department_responsibility_ended",
      "leave_started",
      "returned",
      "retired",
      "corrected",
      "legacy_baseline",
    ])
  })

  test("exports every stable lifecycle error code once", () => {
    expect(new Set(LIFECYCLE_ERROR_CODES).size).toBe(LIFECYCLE_ERROR_CODES.length)
    expect(LIFECYCLE_ERROR_CODES).toContain("lifecycle_action_required")
    expect(LIFECYCLE_ERROR_CODES).toContain("manager_cycle")
    expect(LIFECYCLE_ERROR_CODES).toContain("company_timezone_unavailable")
    expect(LIFECYCLE_ERROR_CODES).toContain("lifecycle_migration_incomplete")
    expect(LIFECYCLE_ERROR_CODES).toContain("lifecycle_projection_mismatch")
  })
})

describe("personnelActionInputSchema", () => {
  test("accepts every managed action with typed fields", () => {
    for (const input of actionInputs) {
      expect(personnelActionInputSchema.safeParse(input).success).toBe(true)
    }
  })

  test("rejects unknown keys for every managed action", () => {
    for (const input of actionInputs) {
      expect(
        personnelActionInputSchema.safeParse({
          ...(input as Record<string, unknown>),
          arbitrary: "must not be accepted",
        }).success,
      ).toBe(false)
    }
  })

  test("requires an explicit position change category", () => {
    expect(
      personnelActionInputSchema.safeParse({
        kind: "position_changed",
        employeeCode: "E100",
        eventOn: "2026-07-01",
        departmentCode: "D001",
        assignmentType: "primary",
        positionTitle: "Lead",
      }).success,
    ).toBe(false)
  })

  test("rejects an unknown key inside a correction replacement action", () => {
    expect(
      personnelActionInputSchema.safeParse({
        kind: "corrected",
        eventOn: "2026-07-02",
        correctsActionId: "00000000-0000-4000-8000-000000000001",
        reason: "入力誤りの訂正",
        replacementAction: {
          kind: "returned",
          employeeCode: "E100",
          eventOn: "2026-07-01",
          arbitrary: true,
        },
      }).success,
    ).toBe(false)
  })
})
