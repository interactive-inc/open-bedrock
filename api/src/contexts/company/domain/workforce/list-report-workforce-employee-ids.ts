import { resolveEmployeeManagementAuthority } from "@/contexts/company/domain/workforce/resolve-employee-management-authority"
import type { WorkforceStateAt } from "@/contexts/company/domain/workforce/resolve-workforce-state"
import type { EmployeeId } from "@/contexts/company/domain/workforce/workforce-id"

/** 管理ラインだけを対象に、actorの配下Employee IDを返す。 */
export function listReportWorkforceEmployeeIds(props: {
  states: ReadonlyArray<WorkforceStateAt>
  actorEmployeeId: EmployeeId
}): ReadonlyArray<EmployeeId> {
  return props.states
    .map((state) => state.employeeId)
    .filter((employeeId) => employeeId !== props.actorEmployeeId)
    .filter(
      (employeeId) =>
        resolveEmployeeManagementAuthority({
          states: props.states,
          actorEmployeeId: props.actorEmployeeId,
          targetEmployeeId: employeeId,
        }).managementChain,
    )
    .toSorted()
}
