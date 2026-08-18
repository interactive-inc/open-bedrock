import type {
  OrganizationalAuthorityManagementEdgeEvidence,
  OrganizationalAuthorityProjection,
} from "@/contexts/company/domain/workforce/organizational-authority"
import { toOrganizationalAuthorityAssignmentEvidence } from "@/contexts/company/domain/workforce/to-organizational-authority-assignment-evidence"
import type { OrgAssignmentPeriod } from "@/contexts/company/domain/workforce/workforce-schedule"
import type { EmployeeId } from "@/contexts/company/domain/workforce/workforce-id"

export function toOrganizationalAuthorityManagementEdgeEvidence(
  assignment: OrgAssignmentPeriod,
  managerEmployeeId: EmployeeId,
  asOf: OrganizationalAuthorityProjection["snapshot"]["asOf"],
): OrganizationalAuthorityManagementEdgeEvidence {
  return {
    ...toOrganizationalAuthorityAssignmentEvidence(assignment, asOf),
    managerEmployeeId,
  }
}
