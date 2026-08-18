import { createWorkforceInvariantViolation } from "@/contexts/company/domain/workforce/create-workforce-invariant-violation"
import { isWorkforceScheduleActiveAt } from "@/contexts/company/domain/workforce/is-workforce-schedule-active-at"
import { listActiveWorkforceManagerRelations } from "@/contexts/company/domain/workforce/list-active-workforce-manager-relations"
import { listWorkforceScheduleBoundaryDates } from "@/contexts/company/domain/workforce/list-workforce-schedule-boundary-dates"
import { workforceManagerRelationsHaveCycle } from "@/contexts/company/domain/workforce/workforce-manager-relations-have-cycle"
import type { WorkforceInvariantViolation } from "@/contexts/company/domain/workforce/workforce-invariant"
import type { WorkforceLifecycleSchedule } from "@/contexts/company/domain/workforce/workforce-schedule"

export function validateWorkforceManagers(
  schedules: ReadonlyArray<WorkforceLifecycleSchedule>,
): WorkforceInvariantViolation | null {
  for (const date of listWorkforceScheduleBoundaryDates(schedules)) {
    const relations = listActiveWorkforceManagerRelations(schedules, date)
    for (const relation of relations) {
      const manager = schedules.find(
        (schedule) => schedule.employeeId === relation.managerEmployeeId,
      )
      if (manager === undefined || !isWorkforceScheduleActiveAt(manager, date)) {
        return createWorkforceInvariantViolation(
          "manager_not_active",
          "manager is not active on assignment date",
        )
      }
    }
    if (workforceManagerRelationsHaveCycle(relations)) {
      return createWorkforceInvariantViolation("manager_cycle", "management chain contains a cycle")
    }
  }
  return null
}
