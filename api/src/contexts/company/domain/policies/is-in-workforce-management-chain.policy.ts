import { isEligibleWorkforceState } from "@/contexts/company/domain/policies/is-eligible-workforce-state.policy"
import { listWorkforceAssignments } from "@/contexts/company/domain/values/list-workforce-assignments.definition"
import type { WorkforceStateAt } from "@/contexts/company/domain/policies/resolve-workforce-state.policy"
import type { EmployeeId } from "@/contexts/company/domain/values/workforce-id.definition"

export function isInWorkforceManagementChain(props: {
  states: ReadonlyMap<EmployeeId, WorkforceStateAt>
  actorEmployeeId: EmployeeId
  targetEmployeeId: EmployeeId
}): boolean {
  const target = props.states.get(props.targetEmployeeId)
  if (!isEligibleWorkforceState(target)) return false

  const pending = listWorkforceAssignments(target).flatMap((assignment) =>
    assignment.managerEmployeeId === null ? [] : [assignment.managerEmployeeId],
  )
  const visited = new Set<EmployeeId>([props.targetEmployeeId])

  while (pending.length > 0) {
    const managerEmployeeId = pending.shift()
    if (managerEmployeeId === undefined || visited.has(managerEmployeeId)) continue
    if (managerEmployeeId === props.actorEmployeeId) return true

    visited.add(managerEmployeeId)
    const manager = props.states.get(managerEmployeeId)
    if (!isEligibleWorkforceState(manager)) continue
    pending.push(
      ...listWorkforceAssignments(manager).flatMap((assignment) =>
        assignment.managerEmployeeId === null ? [] : [assignment.managerEmployeeId],
      ),
    )
  }

  return false
}
