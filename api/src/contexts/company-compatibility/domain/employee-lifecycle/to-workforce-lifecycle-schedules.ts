import { restoreCalendarDate } from "@/contexts/company/domain/workforce/restore-calendar-date"
import type {
  WorkforceLifecycleSchedule,
  WorkforcePeriodVersion,
} from "@/contexts/company/domain/workforce/workforce-schedule"
import {
  type EmployeeId,
  type EmploymentId,
  type OrganizationUnitId,
} from "@/contexts/company/domain/workforce/workforce-id"
import { restoreWorkforceId } from "@/contexts/company/domain/workforce/restore-workforce-id"
import type {
  LifecyclePeriodBase,
  LifecycleSchedule,
} from "@/contexts/company-compatibility/domain/employee-lifecycle/lifecycle-schedule"
import { normalizeLifecycleSchedule } from "@/contexts/company-compatibility/domain/employee-lifecycle/normalize-lifecycle-schedule"
import { periodContainsPeriod } from "@/contexts/company-compatibility/domain/employee-lifecycle/period-contains-period"

export function toWorkforceEmployeeId(value: number): EmployeeId {
  return restoreWorkforceId("employee", `employee:${value}`)
}

function employmentId(periodId: string): EmploymentId {
  return restoreWorkforceId("employment", `employment:${periodId}`)
}

export function toWorkforceOrganizationUnitId(value: string): OrganizationUnitId {
  return restoreWorkforceId("organization_unit", `department:${value}`)
}

function periodVersion(
  periodType: "employment" | "status" | "assignment" | "responsibility",
  period: LifecyclePeriodBase,
): WorkforcePeriodVersion {
  return {
    periodId: restoreWorkforceId("period", `${periodType}-period:${period.periodId}`),
    revision: period.revision,
    startsOn: restoreCalendarDate(period.startsOn),
    endsOn: period.endsOn === null ? null : restoreCalendarDate(period.endsOn),
    isVoid: period.isVoid,
    recordedByActionId: restoreWorkforceId(
      "personnel_action",
      `personnel-action:${period.recordedByActionId}`,
    ),
    recordedAt: period.recordedAt,
  }
}

/** open-bedrockの既存Lifecycleを、製品非依存のCompany Workforceへ損失なく写す。 */
export function toWorkforceLifecycleSchedules(
  schedules: ReadonlyArray<LifecycleSchedule>,
): ReadonlyArray<WorkforceLifecycleSchedule> {
  return schedules.flatMap((source) => {
    const schedule = normalizeLifecycleSchedule(source)
    const employeeIds = new Set<number>([
      ...schedule.employments.map((period) => period.employeeId),
      ...schedule.statuses.map((period) => period.employeeId),
      ...schedule.assignments.map((period) => period.employeeId),
      ...schedule.responsibilities.map((period) => period.employeeId),
    ])

    return [...employeeIds]
      .sort((left, right) => left - right)
      .map((sourceEmployeeId) => {
        const workforceEmployeeId = toWorkforceEmployeeId(sourceEmployeeId)
        const employments = schedule.employments.filter(
          (period) => period.employeeId === sourceEmployeeId,
        )

        return {
          employeeId: workforceEmployeeId,
          employments: employments.map((period) => ({
            ...periodVersion("employment", period),
            employmentId: employmentId(period.periodId),
            employeeId: workforceEmployeeId,
          })),
          statuses: schedule.statuses
            .filter((period) => period.employeeId === sourceEmployeeId)
            .map((period) => ({
              ...periodVersion("status", period),
              employmentId: employmentId(period.employmentPeriodId),
              employeeId: workforceEmployeeId,
              status: period.status === "active" ? ("ACTIVE" as const) : ("ON_LEAVE" as const),
            })),
          assignments: schedule.assignments
            .filter((period) => period.employeeId === sourceEmployeeId)
            .map((period) => ({
              ...periodVersion("assignment", period),
              employmentId: employmentId(period.employmentPeriodId),
              employeeId: workforceEmployeeId,
              organizationUnitId: toWorkforceOrganizationUnitId(period.departmentCode),
              assignmentType:
                period.assignmentType === "primary"
                  ? ("PRIMARY" as const)
                  : ("CONCURRENT" as const),
              positionTitle: period.positionTitle,
              managerEmployeeId:
                period.managerEmployeeId === null
                  ? null
                  : toWorkforceEmployeeId(period.managerEmployeeId),
            })),
          responsibilities: schedule.responsibilities
            .filter((period) => period.employeeId === sourceEmployeeId)
            .map((period) => {
              const containingEmployment = employments.find((employment) =>
                periodContainsPeriod(employment, period),
              )

              return {
                ...periodVersion("responsibility", period),
                employmentId:
                  containingEmployment === undefined
                    ? restoreWorkforceId("employment", `employment:unresolved:${sourceEmployeeId}`)
                    : employmentId(containingEmployment.periodId),
                employeeId: workforceEmployeeId,
                organizationUnitId: toWorkforceOrganizationUnitId(period.departmentCode),
                responsibilityType: "MANAGER" as const,
              }
            }),
        }
      })
  })
}
