import {
  noEmployeeManagementAuthority,
  type EmployeeManagementAuthority,
} from "@/contexts/company/domain/workforce/employee-management-authority"
import { isEligibleWorkforceState } from "@/contexts/company/domain/workforce/is-eligible-workforce-state"
import { isInWorkforceManagementChain } from "@/contexts/company/domain/workforce/is-in-workforce-management-chain"
import { listWorkforceAssignments } from "@/contexts/company/domain/workforce/list-workforce-assignments"
import type { WorkforceStateAt } from "@/contexts/company/domain/workforce/resolve-workforce-state"
import type { EmployeeId } from "@/contexts/company/domain/workforce/workforce-id"

/** 検証済みCompany snapshotだけから、actorの対象Employeeに対する管理範囲を解決する。 */
export function resolveEmployeeManagementAuthority(props: {
  states: ReadonlyArray<WorkforceStateAt>
  actorEmployeeId: EmployeeId
  targetEmployeeId: EmployeeId
}): EmployeeManagementAuthority {
  if (props.actorEmployeeId === props.targetEmployeeId) return noEmployeeManagementAuthority

  const states = new Map(props.states.map((state) => [state.employeeId, state]))
  const actor = states.get(props.actorEmployeeId)
  const target = states.get(props.targetEmployeeId)
  if (!isEligibleWorkforceState(actor) || !isEligibleWorkforceState(target)) {
    return noEmployeeManagementAuthority
  }

  const targetAssignments = listWorkforceAssignments(target)
  const directManager = targetAssignments.some(
    (assignment) => assignment.managerEmployeeId === props.actorEmployeeId,
  )
  const targetOrganizationUnitIds = new Set(
    targetAssignments.map((assignment) => assignment.organizationUnitId),
  )
  const departmentManager = actor.responsibilities.some(
    (responsibility) =>
      responsibility.responsibilityType === "MANAGER" &&
      targetOrganizationUnitIds.has(responsibility.organizationUnitId),
  )

  return {
    directManager,
    departmentManager,
    managementChain: isInWorkforceManagementChain({
      states,
      actorEmployeeId: props.actorEmployeeId,
      targetEmployeeId: props.targetEmployeeId,
    }),
  }
}
