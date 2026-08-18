import type { WorkforceStateAt } from "@/contexts/company/domain/workforce/resolve-workforce-state"
import type { OrgAssignmentPeriod } from "@/contexts/company/domain/workforce/workforce-schedule"

export function listWorkforceStateAssignments(
  state: WorkforceStateAt,
): ReadonlyArray<OrgAssignmentPeriod> {
  return [
    ...(state.primaryAssignment === null ? [] : [state.primaryAssignment]),
    ...state.concurrentAssignments,
  ]
}
