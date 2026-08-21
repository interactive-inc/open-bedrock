import type { OrgResponsibilityPeriod } from "@/contexts/company/domain/values/workforce-schedule.definition"

export function compareOrganizationalAuthorityResponsibilities(
  left: OrgResponsibilityPeriod,
  right: OrgResponsibilityPeriod,
): number {
  return (
    left.employeeId.localeCompare(right.employeeId) ||
    left.organizationUnitId.localeCompare(right.organizationUnitId) ||
    left.responsibilityType.localeCompare(right.responsibilityType) ||
    left.periodId.localeCompare(right.periodId)
  )
}
