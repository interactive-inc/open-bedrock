import { listWorkforceStateAssignments } from "@/contexts/company/domain/workforce/list-workforce-state-assignments"
import type { WorkforceStateAt } from "@/contexts/company/domain/workforce/resolve-workforce-state"
import type { EmployeeId } from "@/contexts/company/domain/workforce/workforce-id"

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
