import type { OrganizationalAuthorityCriterion } from "@/contexts/company/domain/values/organizational-authority-candidate.definition"
import type { WorkflowApproverMatch } from "@/contexts/company/domain/values/company-procedure-approver.definition"
import type { WorkflowApproverSelector } from "@/contexts/company/domain/values/company-procedure-workflow.definition"
import type { CompanyContext } from "@/contexts/company/infrastructure/configuration/company-context.repository"
import { resolveOrganizationalAuthorityCandidates } from "@/contexts/company/infrastructure/organization/resolve-organizational-authority-candidates.repository"

function toCompanyCriterion(selector: WorkflowApproverSelector): OrganizationalAuthorityCriterion {
  switch (selector.type) {
    case "role":
      return { kind: "technical_role", roleKey: selector.role_key }
    case "employee":
      return { kind: "employee", employeeCode: selector.employee_code }
    case "direct_manager":
      return { kind: "direct_manager" }
    case "department_manager":
      return { kind: "department_manager" }
    case "target_department_manager":
      return { kind: "target_department_manager" }
    case "responsibility":
      return {
        kind: "responsibility",
        responsibilityType: selector.responsibility_type,
        organizationUnitCode: selector.organization_unit_code,
      }
    case "management_chain":
      return { kind: "management_chain" }
  }
}

export async function resolveWorkflowApproverMatches(props: {
  c: CompanyContext
  applicantEmployeeId: number | null
  selectors: ReadonlyArray<WorkflowApproverSelector>
  resolvedAt: string
  targetDepartmentCode?: string | null
}): Promise<ReadonlyArray<WorkflowApproverMatch> | Error> {
  const resolution = await resolveOrganizationalAuthorityCandidates({
    c: props.c,
    subjectEmployeeId: props.applicantEmployeeId,
    criteria: props.selectors.map(toCompanyCriterion),
    resolvedAt: props.resolvedAt,
    targetDepartmentCode: props.targetDepartmentCode,
  })
  if (resolution instanceof Error) return resolution

  const matches: WorkflowApproverMatch[] = []
  for (const candidate of resolution.candidates) {
    const selector = props.selectors[candidate.qualification.criterionIndex]
    if (selector === undefined) {
      return new Error("Company authority resolution returned an unknown criterion")
    }
    matches.push({
      employeeId: candidate.employeeId,
      accountId: candidate.accountId,
      provenance: {
        selector_index: candidate.qualification.criterionIndex,
        selector,
        evidence: {
          ...candidate.qualification.evidence,
          authority_snapshot: {
            schema_version: resolution.snapshot.schemaVersion,
            source: resolution.snapshot.source,
            as_of: resolution.snapshot.asOf,
            organization_revision: resolution.snapshot.organizationRevision,
          },
        },
      },
    })
  }

  return matches
}
