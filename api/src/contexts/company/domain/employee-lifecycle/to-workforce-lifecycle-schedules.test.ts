import type { LifecycleSchedule } from "@/contexts/company/domain/employee-lifecycle/lifecycle-schedule"
import { toWorkforceLifecycleSchedules } from "@/contexts/company/domain/employee-lifecycle/to-workforce-lifecycle-schedules"
import { describe, expect, test } from "bun:test"

const schedule: LifecycleSchedule = {
  employments: [
    {
      periodId: "employment-1",
      revision: 2,
      employeeId: 42,
      startsOn: "2026-01-01",
      endsOn: null,
      isVoid: false,
      recordedByActionId: "action-1",
      recordedAt: 2,
    },
  ],
  statuses: [
    {
      periodId: "status-1",
      revision: 1,
      employmentPeriodId: "employment-1",
      employeeId: 42,
      status: "leave",
      startsOn: "2026-01-01",
      endsOn: null,
      isVoid: false,
      recordedByActionId: "action-1",
      recordedAt: 2,
    },
  ],
  assignments: [
    {
      periodId: "assignment-1",
      revision: 1,
      employmentPeriodId: "employment-1",
      employeeId: 42,
      departmentCode: "D001",
      assignmentType: "primary",
      positionTitle: "Manager",
      managerEmployeeId: 7,
      startsOn: "2026-01-01",
      endsOn: null,
      isVoid: false,
      recordedByActionId: "action-1",
      recordedAt: 2,
    },
  ],
  responsibilities: [
    {
      periodId: "responsibility-1",
      revision: 1,
      employeeId: 42,
      departmentCode: "D001",
      responsibilityType: "department_manager",
      startsOn: "2026-01-01",
      endsOn: null,
      isVoid: false,
      recordedByActionId: "action-1",
      recordedAt: 2,
    },
  ],
}

describe("toWorkforceLifecycleSchedules", () => {
  test("maps lifecycle identity, periods, assignment, and responsibility explicitly", () => {
    expect(toWorkforceLifecycleSchedules([schedule])).toEqual([
      expect.objectContaining({
        employeeId: "employee:42",
        employments: [
          expect.objectContaining({
            periodId: "employment-period:employment-1",
            employmentId: "employment:employment-1",
            revision: 2,
          }),
        ],
        statuses: [expect.objectContaining({ status: "ON_LEAVE" })],
        assignments: [
          expect.objectContaining({
            organizationUnitId: "department:D001",
            assignmentType: "PRIMARY",
            managerEmployeeId: "employee:7",
          }),
        ],
        responsibilities: [
          expect.objectContaining({
            employmentId: "employment:employment-1",
            responsibilityType: "MANAGER",
          }),
        ],
      }),
    ])
  })

  test("normalizes revisions and removes a latest void revision before mapping", () => {
    const corrected: LifecycleSchedule = {
      ...schedule,
      assignments: [
        schedule.assignments[0]!,
        { ...schedule.assignments[0]!, revision: 2, isVoid: true },
      ],
    }

    expect(toWorkforceLifecycleSchedules([corrected])[0]?.assignments).toEqual([])
  })
})
