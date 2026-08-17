import type {
  EmployeeStatusPeriod,
  EmploymentPeriod,
  LifecycleSchedule,
  OrgAssignmentPeriod,
  OrgResponsibilityPeriod,
} from "@/contexts/company-compatibility/domain/employee-lifecycle/lifecycle-schedule"
import { validateLifecycleSchedules } from "@/contexts/company-compatibility/domain/employee-lifecycle/validate-lifecycle-schedule"
import { ApplicationError } from "@/lib/errors"
import { describe, expect, test } from "bun:test"

const employment = (
  employeeId: number,
  overrides: Partial<EmploymentPeriod> = {},
): EmploymentPeriod => ({
  periodId: `employment-${employeeId}`,
  revision: 1,
  employeeId,
  startsOn: "2026-01-01",
  endsOn: null,
  isVoid: false,
  recordedByActionId: "action-1",
  recordedAt: 1,
  ...overrides,
})

const status = (
  employeeId: number,
  overrides: Partial<EmployeeStatusPeriod> = {},
): EmployeeStatusPeriod => ({
  periodId: `status-${employeeId}`,
  revision: 1,
  employmentPeriodId: `employment-${employeeId}`,
  employeeId,
  status: "active",
  startsOn: "2026-01-01",
  endsOn: null,
  isVoid: false,
  recordedByActionId: "action-1",
  recordedAt: 1,
  ...overrides,
})

const assignment = (
  employeeId: number,
  departmentCode: string,
  overrides: Partial<OrgAssignmentPeriod> = {},
): OrgAssignmentPeriod => ({
  periodId: `assignment-${employeeId}-${departmentCode}`,
  revision: 1,
  employmentPeriodId: `employment-${employeeId}`,
  employeeId,
  departmentCode,
  assignmentType: "primary",
  positionTitle: "Member",
  managerEmployeeId: null,
  startsOn: "2026-01-01",
  endsOn: null,
  isVoid: false,
  recordedByActionId: "action-1",
  recordedAt: 1,
  ...overrides,
})

const responsibility = (
  employeeId: number,
  departmentCode: string,
  overrides: Partial<OrgResponsibilityPeriod> = {},
): OrgResponsibilityPeriod => ({
  periodId: `responsibility-${employeeId}-${departmentCode}`,
  revision: 1,
  departmentCode,
  responsibilityType: "department_manager",
  employeeId,
  startsOn: "2026-01-01",
  endsOn: null,
  isVoid: false,
  recordedByActionId: "action-1",
  recordedAt: 1,
  ...overrides,
})

const schedule = (
  employeeId: number,
  overrides: Partial<LifecycleSchedule> = {},
): LifecycleSchedule => ({
  employments: [employment(employeeId)],
  statuses: [status(employeeId)],
  assignments: [assignment(employeeId, "D001")],
  responsibilities: [],
  ...overrides,
})

function expectCode(result: unknown, code: string): void {
  expect(result).toBeInstanceOf(ApplicationError)
  expect((result as ApplicationError).code).toBe(code)
}

describe("validateLifecycleSchedules", () => {
  test("accepts contiguous status periods, one primary assignment, and multiple concurrent assignments", () => {
    const result = validateLifecycleSchedules({
      schedules: [
        schedule(1, {
          statuses: [
            status(1, { endsOn: "2026-04-01" }),
            status(1, {
              periodId: "status-leave",
              status: "leave",
              startsOn: "2026-04-01",
              endsOn: "2026-05-01",
            }),
            status(1, { periodId: "status-returned", startsOn: "2026-05-01" }),
          ],
          assignments: [
            assignment(1, "D001"),
            assignment(1, "D002", { assignmentType: "concurrent" }),
            assignment(1, "D003", { assignmentType: "concurrent" }),
          ],
        }),
      ],
      departments: ["D001", "D002", "D003"],
    })

    expect(result).toBeUndefined()
  })

  test("rejects overlapping employments and a gap in status coverage", () => {
    expectCode(
      validateLifecycleSchedules({
        schedules: [
          schedule(1, {
            employments: [
              employment(1),
              employment(1, { periodId: "employment-2", startsOn: "2027-01-01" }),
            ],
          }),
        ],
        departments: ["D001"],
      }),
      "employment_period_conflict",
    )

    expectCode(
      validateLifecycleSchedules({
        schedules: [schedule(1, { statuses: [status(1, { startsOn: "2026-01-02" })] })],
        departments: ["D001"],
      }),
      "status_period_conflict",
    )
  })

  test("rejects overlapping primary and duplicate department assignments", () => {
    expectCode(
      validateLifecycleSchedules({
        schedules: [
          schedule(1, {
            assignments: [assignment(1, "D001"), assignment(1, "D002")],
          }),
        ],
        departments: ["D001", "D002"],
      }),
      "primary_assignment_conflict",
    )

    expectCode(
      validateLifecycleSchedules({
        schedules: [
          schedule(1, {
            assignments: [
              assignment(1, "D001"),
              assignment(1, "D002", { assignmentType: "concurrent" }),
              assignment(1, "D002", {
                periodId: "duplicate",
                assignmentType: "concurrent",
              }),
            ],
          }),
        ],
        departments: ["D001", "D002"],
      }),
      "assignment_period_conflict",
    )
  })

  test("rejects unknown departments, self-management, and inactive managers", () => {
    expectCode(
      validateLifecycleSchedules({ schedules: [schedule(1)], departments: [] }),
      "department_not_active",
    )
    expectCode(
      validateLifecycleSchedules({
        schedules: [
          schedule(1, { assignments: [assignment(1, "D001", { managerEmployeeId: 1 })] }),
        ],
        departments: ["D001"],
      }),
      "manager_cycle",
    )
    expectCode(
      validateLifecycleSchedules({
        schedules: [
          schedule(1, { assignments: [assignment(1, "D001", { managerEmployeeId: 2 })] }),
        ],
        departments: ["D001"],
      }),
      "manager_not_active",
    )
  })

  test("rejects two-party, long, and future-only management cycles", () => {
    const assertCycle = (schedules: ReadonlyArray<LifecycleSchedule>) =>
      expectCode(validateLifecycleSchedules({ schedules, departments: ["D001"] }), "manager_cycle")

    assertCycle([
      schedule(1, { assignments: [assignment(1, "D001", { managerEmployeeId: 2 })] }),
      schedule(2, { assignments: [assignment(2, "D001", { managerEmployeeId: 1 })] }),
    ])
    assertCycle([
      schedule(1, { assignments: [assignment(1, "D001", { managerEmployeeId: 2 })] }),
      schedule(2, { assignments: [assignment(2, "D001", { managerEmployeeId: 3 })] }),
      schedule(3, { assignments: [assignment(3, "D001", { managerEmployeeId: 1 })] }),
    ])
    assertCycle([
      schedule(1, {
        assignments: [
          assignment(1, "D001", { endsOn: "2027-01-01" }),
          assignment(1, "D001", {
            periodId: "future-1",
            startsOn: "2027-01-01",
            managerEmployeeId: 2,
          }),
        ],
      }),
      schedule(2, {
        assignments: [
          assignment(2, "D001", { endsOn: "2027-01-01" }),
          assignment(2, "D001", {
            periodId: "future-2",
            startsOn: "2027-01-01",
            managerEmployeeId: 1,
          }),
        ],
      }),
    ])
  })

  test("requires a department responsibility holder to be active and assigned for its full period", () => {
    expectCode(
      validateLifecycleSchedules({
        schedules: [schedule(1, { responsibilities: [responsibility(1, "D002")] })],
        departments: ["D001", "D002"],
      }),
      "assignment_period_conflict",
    )

    expect(
      validateLifecycleSchedules({
        schedules: [schedule(1, { responsibilities: [responsibility(1, "D001")] })],
        departments: ["D001"],
      }),
    ).toBeUndefined()
  })
})
