import { isEligibleWorkforceState } from "@/contexts/company/domain/workforce/is-eligible-workforce-state"
import { isInWorkforceManagementChain } from "@/contexts/company/domain/workforce/is-in-workforce-management-chain"
import { listWorkforceAssignments } from "@/contexts/company/domain/workforce/list-workforce-assignments"
import type { WorkforceStateAt } from "@/contexts/company/domain/workforce/resolve-workforce-state"
import type { EmployeeId } from "@/contexts/company/domain/workforce/workforce-id"

/** 検証済みsnapshotから、閲覧者と対象者のApp互換関係を解決する。 */
export function resolveWorkforceEmployeeRelation(props: {
  states: ReadonlyArray<WorkforceStateAt>
  viewerEmployeeId: EmployeeId
  targetEmployeeId: EmployeeId
}): Readonly<{ isSelf: boolean; isReport: boolean; isSameDepartment: boolean }> {
  if (props.viewerEmployeeId === props.targetEmployeeId) {
    return { isSelf: true, isReport: false, isSameDepartment: false }
  }

  const states = new Map(props.states.map((state) => [state.employeeId, state]))
  const viewer = states.get(props.viewerEmployeeId)
  const target = states.get(props.targetEmployeeId)
  if (!isEligibleWorkforceState(viewer) || !isEligibleWorkforceState(target)) {
    return { isSelf: false, isReport: false, isSameDepartment: false }
  }

  const viewerOrganizationUnitIds = new Set(
    listWorkforceAssignments(viewer).map((assignment) => assignment.organizationUnitId),
  )
  const isSameDepartment = listWorkforceAssignments(target).some((assignment) =>
    viewerOrganizationUnitIds.has(assignment.organizationUnitId),
  )

  return {
    isSelf: false,
    isReport: isInWorkforceManagementChain({
      states,
      actorEmployeeId: props.viewerEmployeeId,
      targetEmployeeId: props.targetEmployeeId,
    }),
    isSameDepartment,
  }
}
