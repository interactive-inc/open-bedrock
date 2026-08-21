import { OrganizationalAuthorityError } from "@/contexts/company/domain/errors"
import { isCanonicalWorkforcePeriod } from "@/contexts/company/domain/definitions/is-canonical-workforce-period.definition"
import { isOrgResponsibilityType } from "@/contexts/company/domain/definitions/is-org-responsibility-type.definition"
import { isOrganizationalAuthorityStateEligible } from "@/contexts/company/domain/policies/is-organizational-authority-state-eligible.policy"
import { listWorkforceStateAssignments } from "@/contexts/company/domain/definitions/list-workforce-state-assignments.definition"
import type { OrganizationalAuthorityProjection } from "@/contexts/company/domain/definitions/organizational-authority.definition"
import { organizationalAuthorityStatesHaveManagementCycle } from "@/contexts/company/domain/policies/organizational-authority-states-have-management-cycle.policy"
import { periodContainsDate } from "@/contexts/company/domain/definitions/period-contains-date.definition"
import type { WorkforceStateAt } from "@/contexts/company/domain/policies/resolve-workforce-state.policy"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export function validateOrganizationalAuthorityProjection(
  projection: OrganizationalAuthorityProjection,
): OrganizationalAuthorityError | null {
  const revision = projection.snapshot.organizationRevision
  if (!Number.isSafeInteger(revision) || revision < 0) {
    return new OrganizationalAuthorityError("organizational_authority_snapshot_invalid")
  }

  const statesByEmployee = new Map<EmployeeId, WorkforceStateAt>()
  const periodIds = new Set<string>()
  for (const state of projection.states) {
    if (statesByEmployee.has(state.employeeId)) {
      return new OrganizationalAuthorityError("organizational_authority_employee_duplicate")
    }
    statesByEmployee.set(state.employeeId, state)

    if (state.asOf !== projection.snapshot.asOf) {
      return new OrganizationalAuthorityError("organizational_authority_state_as_of_mismatch")
    }
    const hasEligibleStatus = state.status === "ACTIVE" || state.status === "ON_LEAVE"
    if (
      hasEligibleStatus !== (state.employmentId !== null) ||
      (!isOrganizationalAuthorityStateEligible(state) &&
        (state.primaryAssignment !== null ||
          state.concurrentAssignments.length > 0 ||
          state.responsibilities.length > 0))
    ) {
      return new OrganizationalAuthorityError("organizational_authority_state_invalid")
    }

    for (const assignment of listWorkforceStateAssignments(state)) {
      if (
        state.employmentId === null ||
        assignment.employeeId !== state.employeeId ||
        assignment.employmentId !== state.employmentId ||
        !isCanonicalWorkforcePeriod(assignment) ||
        assignment.isVoid ||
        !periodContainsDate(assignment, projection.snapshot.asOf) ||
        (assignment === state.primaryAssignment && assignment.assignmentType !== "PRIMARY") ||
        (assignment !== state.primaryAssignment && assignment.assignmentType !== "CONCURRENT")
      ) {
        return new OrganizationalAuthorityError("organizational_authority_period_invalid")
      }
      if (periodIds.has(assignment.periodId)) {
        return new OrganizationalAuthorityError("organizational_authority_period_duplicate")
      }
      periodIds.add(assignment.periodId)
    }

    for (const responsibility of state.responsibilities) {
      if (
        state.employmentId === null ||
        responsibility.employeeId !== state.employeeId ||
        responsibility.employmentId !== state.employmentId ||
        !isOrgResponsibilityType(responsibility.responsibilityType) ||
        !isCanonicalWorkforcePeriod(responsibility) ||
        responsibility.isVoid ||
        !periodContainsDate(responsibility, projection.snapshot.asOf) ||
        !listWorkforceStateAssignments(state).some(
          (assignment) => assignment.organizationUnitId === responsibility.organizationUnitId,
        )
      ) {
        return new OrganizationalAuthorityError("organizational_authority_period_invalid")
      }
      if (periodIds.has(responsibility.periodId)) {
        return new OrganizationalAuthorityError("organizational_authority_period_duplicate")
      }
      periodIds.add(responsibility.periodId)
    }
  }

  if (
    projection.subjectEmployeeId !== null &&
    !statesByEmployee.has(projection.subjectEmployeeId)
  ) {
    return new OrganizationalAuthorityError("organizational_authority_subject_missing")
  }
  for (const criterion of projection.criteria) {
    if (criterion.kind === "employee" && !statesByEmployee.has(criterion.employeeId)) {
      return new OrganizationalAuthorityError("organizational_authority_employee_reference_missing")
    }
    if (
      criterion.kind === "responsibility" &&
      !isOrgResponsibilityType(criterion.responsibilityType)
    ) {
      return new OrganizationalAuthorityError("organizational_authority_period_invalid")
    }
  }
  for (const state of projection.states) {
    for (const assignment of listWorkforceStateAssignments(state)) {
      if (assignment.managerEmployeeId === null) continue
      const manager = statesByEmployee.get(assignment.managerEmployeeId)
      if (manager === undefined) {
        return new OrganizationalAuthorityError(
          "organizational_authority_employee_reference_missing",
        )
      }
      if (!isOrganizationalAuthorityStateEligible(manager)) {
        return new OrganizationalAuthorityError("organizational_authority_state_invalid")
      }
    }
  }

  const linkedEmployees = new Set<EmployeeId>()
  const linkedAccounts = new Set<string>()
  for (const link of projection.accountLinks) {
    if (!statesByEmployee.has(link.employeeId)) {
      return new OrganizationalAuthorityError("organizational_authority_account_employee_missing")
    }
    if (linkedEmployees.has(link.employeeId)) {
      return new OrganizationalAuthorityError("organizational_authority_account_employee_duplicate")
    }
    if (linkedAccounts.has(link.accountId)) {
      return new OrganizationalAuthorityError("organizational_authority_account_duplicate")
    }
    linkedEmployees.add(link.employeeId)
    linkedAccounts.add(link.accountId)
  }

  return organizationalAuthorityStatesHaveManagementCycle(projection.states)
    ? new OrganizationalAuthorityError("organizational_authority_manager_cycle")
    : null
}
