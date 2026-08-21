import { listWorkforceStateAssignments } from "@/contexts/company/domain/values/list-workforce-state-assignments.definition"
import type { WorkforceStateAt } from "@/contexts/company/domain/policies/resolve-workforce-state.policy"
import type { EmployeeId } from "@/contexts/company/domain/values/workforce-id.definition"

export function organizationalAuthorityStatesHaveManagementCycle(
  states: ReadonlyArray<WorkforceStateAt>,
): boolean {
  const managersByEmployee = new Map<EmployeeId, ReadonlyArray<EmployeeId>>()
  for (const state of states) {
    const managers = listWorkforceStateAssignments(state)
      .flatMap((assignment) =>
        assignment.managerEmployeeId === null ? [] : [assignment.managerEmployeeId],
      )
      .toSorted()
    managersByEmployee.set(state.employeeId, managers)
  }

  for (const employeeId of [...managersByEmployee.keys()].toSorted()) {
    const pending = [{ employeeId, path: new Set<EmployeeId>() }]
    while (pending.length > 0) {
      const current = pending.pop()
      if (current === undefined) break
      if (current.path.has(current.employeeId)) return true
      const path = new Set(current.path).add(current.employeeId)
      for (const managerEmployeeId of managersByEmployee.get(current.employeeId) ?? []) {
        pending.push({ employeeId: managerEmployeeId, path })
      }
    }
  }
  return false
}
