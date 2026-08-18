import { compareOrganizationalAuthorityAssignments } from "@/contexts/company/domain/workforce/compare-organizational-authority-assignments"
import { compareOrganizationalAuthorityResponsibilities } from "@/contexts/company/domain/workforce/compare-organizational-authority-responsibilities"
import { listOrganizationalAuthorityManagementChainCandidates } from "@/contexts/company/domain/workforce/list-organizational-authority-management-chain-candidates"
import { listWorkforceStateAssignments } from "@/contexts/company/domain/workforce/list-workforce-state-assignments"
import type { OrganizationalAuthorityCandidateEvidence } from "@/contexts/company/domain/workforce/organizational-authority-candidate-evidence"
import type {
  OrganizationalAuthorityCriterion,
  OrganizationalAuthorityEvidence,
  OrganizationalAuthorityProjection,
} from "@/contexts/company/domain/workforce/organizational-authority"
import type { WorkforceStateAt } from "@/contexts/company/domain/workforce/resolve-workforce-state"
import { toOrganizationalAuthorityAssignmentEvidence } from "@/contexts/company/domain/workforce/to-organizational-authority-assignment-evidence"
import { toOrganizationalAuthorityManagementEdgeEvidence } from "@/contexts/company/domain/workforce/to-organizational-authority-management-edge-evidence"
import { toOrganizationalAuthorityResponsibilityEvidence } from "@/contexts/company/domain/workforce/to-organizational-authority-responsibility-evidence"
import type { EmployeeId } from "@/contexts/company/domain/workforce/workforce-id"

export function resolveOrganizationalAuthorityCriterion(props: {
  criterion: OrganizationalAuthorityCriterion
  statesByEmployee: ReadonlyMap<EmployeeId, WorkforceStateAt>
  subjectEmployeeId: EmployeeId | null
  asOf: OrganizationalAuthorityProjection["snapshot"]["asOf"]
}): ReadonlyArray<OrganizationalAuthorityCandidateEvidence> {
  if (props.criterion.kind === "employee") {
    return [
      {
        employeeId: props.criterion.employeeId,
        evidence: { kind: "employee", employeeId: props.criterion.employeeId },
      },
    ]
  }
  if (
    props.subjectEmployeeId === null &&
    props.criterion.kind !== "target_organization_manager" &&
    props.criterion.kind !== "responsibility"
  ) {
    return []
  }

  const subject =
    props.subjectEmployeeId === null
      ? undefined
      : props.statesByEmployee.get(props.subjectEmployeeId)
  const subjectAssignments =
    subject === undefined
      ? []
      : listWorkforceStateAssignments(subject).toSorted(compareOrganizationalAuthorityAssignments)

  if (props.criterion.kind === "direct_manager") {
    return subjectAssignments.flatMap((assignment) => {
      const managerEmployeeId = assignment.managerEmployeeId
      if (managerEmployeeId === null) return []
      const evidence: OrganizationalAuthorityEvidence = {
        kind: "direct_manager",
        assignment: toOrganizationalAuthorityManagementEdgeEvidence(
          assignment,
          managerEmployeeId,
          props.asOf,
        ),
      }
      return [{ employeeId: managerEmployeeId, evidence }]
    })
  }

  const responsibilities = [...props.statesByEmployee.values()]
    .flatMap((state) => state.responsibilities)
    .toSorted(compareOrganizationalAuthorityResponsibilities)
  if (props.criterion.kind === "subject_organization_manager") {
    return subjectAssignments.flatMap((assignment) =>
      responsibilities
        .filter(
          (responsibility) =>
            responsibility.responsibilityType === "MANAGER" &&
            responsibility.organizationUnitId === assignment.organizationUnitId,
        )
        .map(
          (responsibility): OrganizationalAuthorityCandidateEvidence => ({
            employeeId: responsibility.employeeId,
            evidence: {
              kind: "organization_manager",
              scope: "subject",
              subjectAssignment: toOrganizationalAuthorityAssignmentEvidence(
                assignment,
                props.asOf,
              ),
              responsibility: toOrganizationalAuthorityResponsibilityEvidence(
                responsibility,
                props.asOf,
              ),
            },
          }),
        ),
    )
  }
  if (props.criterion.kind === "target_organization_manager") {
    const criterion = props.criterion
    return responsibilities
      .filter(
        (responsibility) =>
          responsibility.responsibilityType === "MANAGER" &&
          responsibility.organizationUnitId === criterion.organizationUnitId,
      )
      .map(
        (responsibility): OrganizationalAuthorityCandidateEvidence => ({
          employeeId: responsibility.employeeId,
          evidence: {
            kind: "organization_manager",
            scope: "target",
            subjectAssignment: null,
            responsibility: toOrganizationalAuthorityResponsibilityEvidence(
              responsibility,
              props.asOf,
            ),
          },
        }),
      )
  }
  if (props.criterion.kind === "responsibility") {
    const criterion = props.criterion
    return responsibilities
      .filter(
        (responsibility) =>
          responsibility.responsibilityType === criterion.responsibilityType &&
          (criterion.organizationUnitId === null ||
            responsibility.organizationUnitId === criterion.organizationUnitId),
      )
      .map(
        (responsibility): OrganizationalAuthorityCandidateEvidence => ({
          employeeId: responsibility.employeeId,
          evidence: {
            kind: "responsibility",
            responsibility: toOrganizationalAuthorityResponsibilityEvidence(
              responsibility,
              props.asOf,
            ),
          },
        }),
      )
  }
  if (props.subjectEmployeeId === null) return []

  return listOrganizationalAuthorityManagementChainCandidates({
    statesByEmployee: props.statesByEmployee,
    subjectEmployeeId: props.subjectEmployeeId,
    asOf: props.asOf,
  })
}
