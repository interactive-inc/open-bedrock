import type { OrgAssignmentPeriod } from "@/contexts/company/domain/workforce/workforce-schedule"

/** Company Assignmentをstorage型を含まない公開表現へ変換する。 */
export function toCompanyAssignmentResponse(assignment: OrgAssignmentPeriod) {
  return {
    period_id: assignment.periodId,
    revision: assignment.revision,
    employment_id: assignment.employmentId,
    employee_id: assignment.employeeId,
    organization_unit_id: assignment.organizationUnitId,
    assignment_type: assignment.assignmentType,
    position_title: assignment.positionTitle,
    manager_employee_id: assignment.managerEmployeeId,
    starts_on: assignment.startsOn,
    ends_on: assignment.endsOn,
    is_void: assignment.isVoid,
    recorded_by_operation_id: assignment.recordedByActionId,
    recorded_at: new Date(assignment.recordedAt).toISOString(),
  }
}
