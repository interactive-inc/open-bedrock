import type { OrgResponsibilityPeriod } from "@/contexts/company/domain/workforce/workforce-schedule"

/** Company Responsibilityをstorage型を含まない公開表現へ変換する。 */
export function toCompanyResponsibilityResponse(responsibility: OrgResponsibilityPeriod) {
  return {
    period_id: responsibility.periodId,
    revision: responsibility.revision,
    employment_id: responsibility.employmentId,
    employee_id: responsibility.employeeId,
    organization_unit_id: responsibility.organizationUnitId,
    responsibility_type: responsibility.responsibilityType,
    starts_on: responsibility.startsOn,
    ends_on: responsibility.endsOn,
    is_void: responsibility.isVoid,
    recorded_by_operation_id: responsibility.recordedByActionId,
    recorded_at: new Date(responsibility.recordedAt).toISOString(),
  }
}
