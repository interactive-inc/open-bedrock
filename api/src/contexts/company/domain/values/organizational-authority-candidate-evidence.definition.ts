import type { OrganizationalAuthorityEvidence } from "@/contexts/company/domain/values/organizational-authority.definition"
import type { EmployeeId } from "@/contexts/company/domain/values/workforce-id.definition"

export type OrganizationalAuthorityCandidateEvidence = Readonly<{
  employeeId: EmployeeId
  evidence: OrganizationalAuthorityEvidence
}>
