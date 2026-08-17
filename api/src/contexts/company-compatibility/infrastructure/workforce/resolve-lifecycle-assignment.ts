import type { OrgAssignmentPeriod } from "@/contexts/company/domain/workforce/workforce-schedule"
import type { LifecycleAssignmentState } from "@/contexts/company-compatibility/infrastructure/employee-lifecycle/employee-lifecycle-read-repository"
import { toLifecycleStorageId } from "@/contexts/company-compatibility/infrastructure/workforce/to-lifecycle-storage-id"

type Props = Readonly<{
  assignment: OrgAssignmentPeriod
  projections: ReadonlyArray<LifecycleAssignmentState>
}>

/** 共通assignmentに対応する表示projectionを一意に解決し、意味のdriftを拒否する。 */
export function resolveLifecycleAssignment(props: Props): LifecycleAssignmentState | Error {
  const periodId = toLifecycleStorageId(String(props.assignment.periodId), "assignment-period:")
  const employmentPeriodId = toLifecycleStorageId(
    String(props.assignment.employmentId),
    "employment:",
  )
  const departmentCode = toLifecycleStorageId(
    String(props.assignment.organizationUnitId),
    "department:",
  )

  if (periodId instanceof Error) return periodId
  if (employmentPeriodId instanceof Error) return employmentPeriodId
  if (departmentCode instanceof Error) return departmentCode

  const projection = props.projections.find((candidate) => candidate.periodId === periodId)
  const managerEmployeeId = props.assignment.managerEmployeeId
  const hasSameManager =
    managerEmployeeId === null
      ? projection?.managerEmployeeId === null
      : String(managerEmployeeId) === `employee:${String(projection?.managerEmployeeId)}`

  if (
    projection === undefined ||
    projection.employmentPeriodId !== employmentPeriodId ||
    projection.departmentCode !== departmentCode ||
    projection.assignmentType !== props.assignment.assignmentType.toLowerCase() ||
    projection.positionTitle !== props.assignment.positionTitle ||
    projection.startsOn !== props.assignment.startsOn ||
    projection.endsOn !== props.assignment.endsOn ||
    !hasSameManager
  ) {
    return new Error("workforce assignment differs from the lifecycle projection")
  }

  return projection
}
