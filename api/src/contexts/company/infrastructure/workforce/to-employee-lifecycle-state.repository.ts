import { resolveLifecycleAssignment } from "@/contexts/company/infrastructure/workforce/resolve-lifecycle-assignment.repository"
import { toLifecycleStatus } from "@/contexts/company/infrastructure/workforce/to-lifecycle-status.repository"
import { toLifecycleStorageId } from "@/contexts/company/infrastructure/workforce/to-lifecycle-storage-id.repository"
import type { WorkforceStateAt } from "@/contexts/company/domain/workforce/resolve-workforce-state"
import type {
  EmployeeLifecycleState,
  LifecycleAssignmentState,
} from "@/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle-read.repository"

type Props = Readonly<{
  workforce: WorkforceStateAt
  projection: EmployeeLifecycleState
}>

/** 共通Workforceの判断へ、既存APIだけが必要とする表示値とrevisionを合成する。 */
export function toEmployeeLifecycleState(props: Props): EmployeeLifecycleState | Error {
  const employmentPeriodId =
    props.workforce.employmentId === null
      ? null
      : toLifecycleStorageId(String(props.workforce.employmentId), "employment:")

  if (employmentPeriodId instanceof Error) return employmentPeriodId
  if (props.projection.employmentPeriodId !== employmentPeriodId) {
    return new Error("workforce employment differs from the lifecycle projection")
  }

  const projectionAssignments = [
    ...(props.projection.primaryAssignment === null ? [] : [props.projection.primaryAssignment]),
    ...props.projection.concurrentAssignments,
  ]
  const concurrentAssignments: LifecycleAssignmentState[] = []
  const primaryAssignment =
    props.workforce.primaryAssignment === null
      ? null
      : resolveLifecycleAssignment({
          assignment: props.workforce.primaryAssignment,
          projections: projectionAssignments,
        })

  if (primaryAssignment instanceof Error) return primaryAssignment

  for (const assignment of props.workforce.concurrentAssignments) {
    const resolved = resolveLifecycleAssignment({ assignment, projections: projectionAssignments })

    if (resolved instanceof Error) return resolved
    concurrentAssignments.push(resolved)
  }

  if (projectionAssignments.length !== concurrentAssignments.length + (primaryAssignment ? 1 : 0)) {
    return new Error("lifecycle projection contains an assignment absent from workforce state")
  }

  const responsibilityDepartmentCodes: string[] = []

  for (const responsibility of props.workforce.responsibilities) {
    // 旧wireのdepartment codesは部門管理責務だけを表す。
    if (responsibility.responsibilityType !== "MANAGER") continue
    const departmentCode = toLifecycleStorageId(
      String(responsibility.organizationUnitId),
      "department:",
    )

    if (departmentCode instanceof Error) return departmentCode
    responsibilityDepartmentCodes.push(departmentCode)
  }

  responsibilityDepartmentCodes.sort()
  const projectedResponsibilityDepartmentCodes = [
    ...props.projection.responsibilityDepartmentCodes,
  ].sort()
  if (
    responsibilityDepartmentCodes.length !== projectedResponsibilityDepartmentCodes.length ||
    responsibilityDepartmentCodes.some(
      (departmentCode, index) => departmentCode !== projectedResponsibilityDepartmentCodes[index],
    )
  ) {
    return new Error("workforce responsibilities differ from the lifecycle projection")
  }

  return {
    ...props.projection,
    asOf: props.workforce.asOf,
    status: toLifecycleStatus(props.workforce.status),
    employmentPeriodId,
    primaryAssignment,
    concurrentAssignments,
    responsibilityDepartmentCodes,
  }
}
