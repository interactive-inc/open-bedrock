import { resolveEmployeeManagementAuthority } from "@/contexts/company/domain/workforce/resolve-employee-management-authority"
import type { WorkforceStateAt } from "@/contexts/company/domain/workforce/resolve-workforce-state"
import type { EmployeeId } from "@/contexts/company/domain/workforce/workforce-id"

/** 検証済みCompany snapshotだけから、actorが管理できるEmployee IDを決定的に返す。 */
export function listManagedWorkforceEmployeeIds(props: {
  states: ReadonlyArray<WorkforceStateAt>
  actorEmployeeId: EmployeeId
}): ReadonlyArray<EmployeeId> {
  return props.states
    .map((state) => state.employeeId)
    .filter((employeeId) => employeeId !== props.actorEmployeeId)
    .filter((employeeId) => {
      const authority = resolveEmployeeManagementAuthority({
        states: props.states,
        actorEmployeeId: props.actorEmployeeId,
        targetEmployeeId: employeeId,
      })
      return authority.managementChain || authority.departmentManager
    })
    .toSorted()
}
