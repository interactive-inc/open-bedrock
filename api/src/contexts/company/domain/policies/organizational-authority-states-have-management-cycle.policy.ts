import { listWorkforceStateAssignments } from "@/contexts/company/domain/definitions/list-workforce-state-assignments.definition"
import { hasManagementCycle } from "@/contexts/company/domain/definitions/has-management-cycle.definition"
import type { WorkforceStateAt } from "@/contexts/company/domain/policies/resolve-workforce-state.policy"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export function organizationalAuthorityStatesHaveManagementCycle(
  states: ReadonlyArray<WorkforceStateAt>,
): boolean {
  const managersByEmployee = new Map<EmployeeId, ReadonlyArray<EmployeeId>>()
  for (const state of states) {
    const managers = listWorkforceStateAssignments(state).flatMap((assignment) =>
      assignment.managerEmployeeId === null ? [] : [assignment.managerEmployeeId],
    )
    managersByEmployee.set(state.employeeId, managers)
  }

  return hasManagementCycle(managersByEmployee)
}
