import { createOrganizationalAuthorityError } from "@/contexts/company/domain/workforce/create-organizational-authority-error"
import { isCanonicalWorkforcePeriod } from "@/contexts/company/domain/workforce/is-canonical-workforce-period"
import { isOrgResponsibilityType } from "@/contexts/company/domain/workforce/is-org-responsibility-type"
import { isOrganizationalAuthorityStateEligible } from "@/contexts/company/domain/workforce/is-organizational-authority-state-eligible"
import { listWorkforceStateAssignments } from "@/contexts/company/domain/workforce/list-workforce-state-assignments"
import type { OrganizationalAuthorityError } from "@/contexts/company/domain/workforce/organizational-authority-error"
import type { OrganizationalAuthorityProjection } from "@/contexts/company/domain/workforce/organizational-authority"
import { organizationalAuthorityStatesHaveManagementCycle } from "@/contexts/company/domain/workforce/organizational-authority-states-have-management-cycle"
import { periodContainsDate } from "@/contexts/company/domain/workforce/period-contains-date"
import type { WorkforceStateAt } from "@/contexts/company/domain/workforce/resolve-workforce-state"
import type { EmployeeId } from "@/contexts/company/domain/workforce/workforce-id"

export function validateOrganizationalAuthorityProjection(
  projection: OrganizationalAuthorityProjection,
): OrganizationalAuthorityError | null {
  const revision = projection.snapshot.organizationRevision
  if (
    (projection.snapshot.source === "legacy" && revision !== null) ||
    (projection.snapshot.source === "lifecycle" &&
      (revision === null || !Number.isSafeInteger(revision) || revision < 0))
  ) {
    return createOrganizationalAuthorityError("organizational_authority_snapshot_invalid")
  }

  const statesByEmployee = new Map<EmployeeId, WorkforceStateAt>()
  const periodIds = new Set<string>()
  for (const state of projection.states) {
    if (statesByEmployee.has(state.employeeId)) {
      return createOrganizationalAuthorityError("organizational_authority_employee_duplicate")
    }
    statesByEmployee.set(state.employeeId, state)

    if (state.asOf !== projection.snapshot.asOf) {
      return createOrganizationalAuthorityError("organizational_authority_state_as_of_mismatch")
    }
    const hasEligibleStatus = state.status === "ACTIVE" || state.status === "ON_LEAVE"
    if (
      hasEligibleStatus !== (state.employmentId !== null) ||
      (!isOrganizationalAuthorityStateEligible(state) &&
        (state.primaryAssignment !== null ||
          state.concurrentAssignments.length > 0 ||
          state.responsibilities.length > 0))
    ) {
      return createOrganizationalAuthorityError("organizational_authority_state_invalid")
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
        return createOrganizationalAuthorityError("organizational_authority_period_invalid")
      }
      if (periodIds.has(assignment.periodId)) {
        return createOrganizationalAuthorityError("organizational_authority_period_duplicate")
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
        return createOrganizationalAuthorityError("organizational_authority_period_invalid")
      }
      if (periodIds.has(responsibility.periodId)) {
        return createOrganizationalAuthorityError("organizational_authority_period_duplicate")
      }
      periodIds.add(responsibility.periodId)
    }
  }

  if (
    projection.subjectEmployeeId !== null &&
    !statesByEmployee.has(projection.subjectEmployeeId)
  ) {
    return createOrganizationalAuthorityError("organizational_authority_subject_missing")
  }
  for (const criterion of projection.criteria) {
    if (criterion.kind === "employee" && !statesByEmployee.has(criterion.employeeId)) {
      return createOrganizationalAuthorityError(
        "organizational_authority_employee_reference_missing",
      )
    }
    if (
      criterion.kind === "responsibility" &&
      !isOrgResponsibilityType(criterion.responsibilityType)
    ) {
      return createOrganizationalAuthorityError("organizational_authority_period_invalid")
    }
  }
  for (const state of projection.states) {
    for (const assignment of listWorkforceStateAssignments(state)) {
      if (assignment.managerEmployeeId === null) continue
      const manager = statesByEmployee.get(assignment.managerEmployeeId)
      if (manager === undefined) {
        return createOrganizationalAuthorityError(
          "organizational_authority_employee_reference_missing",
        )
      }
      if (!isOrganizationalAuthorityStateEligible(manager)) {
        return createOrganizationalAuthorityError("organizational_authority_state_invalid")
      }
    }
  }

  const linkedEmployees = new Set<EmployeeId>()
  const linkedAccounts = new Set<string>()
  for (const link of projection.accountLinks) {
    if (!statesByEmployee.has(link.employeeId)) {
      return createOrganizationalAuthorityError("organizational_authority_account_employee_missing")
    }
    if (linkedEmployees.has(link.employeeId)) {
      return createOrganizationalAuthorityError(
        "organizational_authority_account_employee_duplicate",
      )
    }
    if (linkedAccounts.has(link.accountId)) {
      return createOrganizationalAuthorityError("organizational_authority_account_duplicate")
    }
    linkedEmployees.add(link.employeeId)
    linkedAccounts.add(link.accountId)
  }

  return organizationalAuthorityStatesHaveManagementCycle(projection.states)
    ? createOrganizationalAuthorityError("organizational_authority_manager_cycle")
    : null
}
