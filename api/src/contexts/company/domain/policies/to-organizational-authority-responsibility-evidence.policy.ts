import type {
  OrganizationalAuthorityProjection,
  OrganizationalAuthorityResponsibilityEvidence,
} from "@/contexts/company/domain/values/organizational-authority.definition"
import type { OrgResponsibilityPeriod } from "@/contexts/company/domain/values/workforce-schedule.definition"

export function toOrganizationalAuthorityResponsibilityEvidence(
  responsibility: OrgResponsibilityPeriod,
  asOf: OrganizationalAuthorityProjection["snapshot"]["asOf"],
): OrganizationalAuthorityResponsibilityEvidence {
  return {
    employeeId: responsibility.employeeId,
    organizationUnitId: responsibility.organizationUnitId,
    responsibilityType: responsibility.responsibilityType,
    responsibilityPeriodId: responsibility.periodId,
    responsibilityRevision: responsibility.revision,
    asOf,
  }
}
