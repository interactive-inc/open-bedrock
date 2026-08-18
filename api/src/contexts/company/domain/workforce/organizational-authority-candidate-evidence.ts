import type { OrganizationalAuthorityEvidence } from "@/contexts/company/domain/workforce/organizational-authority"
import type { EmployeeId } from "@/contexts/company/domain/workforce/workforce-id"

export type OrganizationalAuthorityCandidateEvidence = Readonly<{
  employeeId: EmployeeId
  evidence: OrganizationalAuthorityEvidence
}>
