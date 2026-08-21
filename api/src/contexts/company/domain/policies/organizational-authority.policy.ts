import type {
  AccountEmployeeLink,
  OrgAssignmentPeriod,
  OrgResponsibilityPeriod,
  WorkforcePeriodVersion,
} from "@/contexts/company/domain/entities/workforce-schedule.entity"
import { OrganizationalAuthorityError } from "@/contexts/company/domain/errors"
import type { OrganizationalAuthorityCandidateEvidence } from "@/contexts/company/domain/values/organizational-authority-candidate-evidence.definition"
import type {
  OrganizationalAuthorityAssignmentEvidence,
  OrganizationalAuthorityCandidate,
  OrganizationalAuthorityCriterion,
  OrganizationalAuthorityEvidence,
  OrganizationalAuthorityManagementEdgeEvidence,
  OrganizationalAuthorityProjection,
  OrganizationalAuthorityResolution,
  OrganizationalAuthorityResponsibilityEvidence,
} from "@/contexts/company/domain/values/organizational-authority.definition"
import { isCalendarDate } from "@/contexts/company/domain/values/is-calendar-date.definition"
import { isOrgResponsibilityType } from "@/contexts/company/domain/values/org-responsibility-type.definition"
import {
  WorkforceStateValue,
  type WorkforceStateProps,
} from "@/contexts/company/domain/values/workforce-state.value"
import type { EmployeeId } from "@/contexts/company/domain/values/workforce-id.definition"

function error(
  code: ConstructorParameters<typeof OrganizationalAuthorityError>[0],
): OrganizationalAuthorityError {
  return new OrganizationalAuthorityError(code)
}

function isCanonicalPeriod(period: WorkforcePeriodVersion): boolean {
  return (
    Number.isSafeInteger(period.revision) &&
    period.revision >= 1 &&
    Number.isSafeInteger(period.recordedAt) &&
    period.recordedAt >= 0 &&
    isCalendarDate(period.startsOn) &&
    (period.endsOn === null || (isCalendarDate(period.endsOn) && period.startsOn < period.endsOn))
  )
}

function containsDate(period: WorkforcePeriodVersion, date: string): boolean {
  return period.startsOn <= date && (period.endsOn === null || date < period.endsOn)
}

function assignments(state: WorkforceStateProps): ReadonlyArray<OrgAssignmentPeriod> {
  return [
    ...(state.primaryAssignment === null ? [] : [state.primaryAssignment]),
    ...state.concurrentAssignments,
  ]
}

function compareAssignments(left: OrgAssignmentPeriod, right: OrgAssignmentPeriod): number {
  return (
    String(left.managerEmployeeId).localeCompare(String(right.managerEmployeeId)) ||
    left.organizationUnitId.localeCompare(right.organizationUnitId) ||
    left.periodId.localeCompare(right.periodId)
  )
}

function compareResponsibilities(
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

function assignmentEvidence(
  assignment: OrgAssignmentPeriod,
  asOf: OrganizationalAuthorityProjection["snapshot"]["asOf"],
): OrganizationalAuthorityAssignmentEvidence {
  return {
    employeeId: assignment.employeeId,
    managerEmployeeId: assignment.managerEmployeeId,
    organizationUnitId: assignment.organizationUnitId,
    assignmentPeriodId: assignment.periodId,
    assignmentRevision: assignment.revision,
    asOf,
  }
}

function managementEdgeEvidence(
  assignment: OrgAssignmentPeriod,
  managerEmployeeId: EmployeeId,
  asOf: OrganizationalAuthorityProjection["snapshot"]["asOf"],
): OrganizationalAuthorityManagementEdgeEvidence {
  return { ...assignmentEvidence(assignment, asOf), managerEmployeeId }
}

function responsibilityEvidence(
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

function statesHaveManagementCycle(states: ReadonlyArray<WorkforceStateProps>): boolean {
  const managersByEmployee = new Map<EmployeeId, ReadonlyArray<EmployeeId>>()
  for (const state of states) {
    const managers = assignments(state)
      .flatMap((assignment) =>
        assignment.managerEmployeeId === null ? [] : [assignment.managerEmployeeId],
      )
      .toSorted()
    managersByEmployee.set(state.employeeId, managers)
  }

  for (const employeeId of [...managersByEmployee.keys()].toSorted()) {
    const pending = [{ employeeId, path: new Set<EmployeeId>() }]
    while (pending.length > 0) {
      const current = pending.pop()
      if (current === undefined) break
      if (current.path.has(current.employeeId)) return true
      const path = new Set(current.path).add(current.employeeId)
      for (const managerEmployeeId of managersByEmployee.get(current.employeeId) ?? []) {
        pending.push({ employeeId: managerEmployeeId, path })
      }
    }
  }
  return false
}

function validateProjection(
  projection: OrganizationalAuthorityProjection,
): OrganizationalAuthorityError | null {
  const revision = projection.snapshot.organizationRevision
  if (!Number.isSafeInteger(revision) || revision < 0) {
    return error("organizational_authority_snapshot_invalid")
  }

  const statesByEmployee = new Map<EmployeeId, WorkforceStateProps>()
  const periodIds = new Set<string>()
  for (const state of projection.states) {
    if (statesByEmployee.has(state.employeeId)) {
      return error("organizational_authority_employee_duplicate")
    }
    statesByEmployee.set(state.employeeId, state)
    if (state.asOf !== projection.snapshot.asOf) {
      return error("organizational_authority_state_as_of_mismatch")
    }
    const hasEligibleStatus = state.status === "ACTIVE" || state.status === "ON_LEAVE"
    if (
      hasEligibleStatus !== (state.employmentId !== null) ||
      (!hasEligibleStatus &&
        (state.primaryAssignment !== null ||
          state.concurrentAssignments.length > 0 ||
          state.responsibilities.length > 0))
    ) {
      return error("organizational_authority_state_invalid")
    }

    for (const assignment of assignments(state)) {
      if (
        state.employmentId === null ||
        assignment.employeeId !== state.employeeId ||
        assignment.employmentId !== state.employmentId ||
        !isCanonicalPeriod(assignment) ||
        assignment.isVoid ||
        !containsDate(assignment, projection.snapshot.asOf) ||
        (assignment === state.primaryAssignment && assignment.assignmentType !== "PRIMARY") ||
        (assignment !== state.primaryAssignment && assignment.assignmentType !== "CONCURRENT")
      ) {
        return error("organizational_authority_period_invalid")
      }
      if (periodIds.has(assignment.periodId)) {
        return error("organizational_authority_period_duplicate")
      }
      periodIds.add(assignment.periodId)
    }

    for (const responsibility of state.responsibilities) {
      if (
        state.employmentId === null ||
        responsibility.employeeId !== state.employeeId ||
        responsibility.employmentId !== state.employmentId ||
        !isOrgResponsibilityType(responsibility.responsibilityType) ||
        !isCanonicalPeriod(responsibility) ||
        responsibility.isVoid ||
        !containsDate(responsibility, projection.snapshot.asOf) ||
        !assignments(state).some(
          (assignment) => assignment.organizationUnitId === responsibility.organizationUnitId,
        )
      ) {
        return error("organizational_authority_period_invalid")
      }
      if (periodIds.has(responsibility.periodId)) {
        return error("organizational_authority_period_duplicate")
      }
      periodIds.add(responsibility.periodId)
    }
  }

  if (
    projection.subjectEmployeeId !== null &&
    !statesByEmployee.has(projection.subjectEmployeeId)
  ) {
    return error("organizational_authority_subject_missing")
  }
  for (const criterion of projection.criteria) {
    if (criterion.kind === "employee" && !statesByEmployee.has(criterion.employeeId)) {
      return error("organizational_authority_employee_reference_missing")
    }
    if (
      criterion.kind === "responsibility" &&
      !isOrgResponsibilityType(criterion.responsibilityType)
    ) {
      return error("organizational_authority_period_invalid")
    }
  }
  for (const state of projection.states) {
    for (const assignment of assignments(state)) {
      if (assignment.managerEmployeeId === null) continue
      const manager = statesByEmployee.get(assignment.managerEmployeeId)
      if (manager === undefined) {
        return error("organizational_authority_employee_reference_missing")
      }
      if (
        manager.employmentId === null ||
        (manager.status !== "ACTIVE" && manager.status !== "ON_LEAVE")
      ) {
        return error("organizational_authority_state_invalid")
      }
    }
  }

  const linkedEmployees = new Set<EmployeeId>()
  const linkedAccounts = new Set<string>()
  for (const link of projection.accountLinks) {
    if (!statesByEmployee.has(link.employeeId)) {
      return error("organizational_authority_account_employee_missing")
    }
    if (linkedEmployees.has(link.employeeId)) {
      return error("organizational_authority_account_employee_duplicate")
    }
    if (linkedAccounts.has(link.accountId)) {
      return error("organizational_authority_account_duplicate")
    }
    linkedEmployees.add(link.employeeId)
    linkedAccounts.add(link.accountId)
  }

  return statesHaveManagementCycle(projection.states)
    ? error("organizational_authority_manager_cycle")
    : null
}

function managementChainCandidates(props: {
  statesByEmployee: ReadonlyMap<EmployeeId, WorkforceStateValue>
  subjectEmployeeId: EmployeeId
  asOf: OrganizationalAuthorityProjection["snapshot"]["asOf"]
}): ReadonlyArray<OrganizationalAuthorityCandidateEvidence> {
  const edgesByEmployee = new Map<
    EmployeeId,
    ReadonlyArray<OrganizationalAuthorityManagementEdgeEvidence>
  >()
  for (const state of props.statesByEmployee.values()) {
    const edges = state.assignments
      .toSorted(compareAssignments)
      .flatMap((assignment) =>
        assignment.managerEmployeeId === null
          ? []
          : [managementEdgeEvidence(assignment, assignment.managerEmployeeId, props.asOf)],
      )
    edgesByEmployee.set(state.employeeId, edges)
  }

  const pending = (edgesByEmployee.get(props.subjectEmployeeId) ?? []).map((edge) => ({
    employeeId: edge.managerEmployeeId,
    path: [edge],
  }))
  const visited = new Set<EmployeeId>([props.subjectEmployeeId])
  const candidates: OrganizationalAuthorityCandidateEvidence[] = []
  while (pending.length > 0) {
    const current = pending.shift()
    if (current === undefined) break
    if (visited.has(current.employeeId)) continue
    visited.add(current.employeeId)
    candidates.push({
      employeeId: current.employeeId,
      evidence: { kind: "management_chain", path: current.path },
    })
    pending.push(
      ...(edgesByEmployee.get(current.employeeId) ?? []).map((edge) => ({
        employeeId: edge.managerEmployeeId,
        path: [...current.path, edge],
      })),
    )
  }
  return candidates
}

function resolveCriterion(props: {
  criterion: OrganizationalAuthorityCriterion
  statesByEmployee: ReadonlyMap<EmployeeId, WorkforceStateValue>
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
  const subjectAssignments = subject?.assignments.toSorted(compareAssignments) ?? []
  if (props.criterion.kind === "direct_manager") {
    return subjectAssignments.flatMap((assignment) => {
      if (assignment.managerEmployeeId === null) return []
      const evidence: OrganizationalAuthorityEvidence = {
        kind: "direct_manager",
        assignment: managementEdgeEvidence(assignment, assignment.managerEmployeeId, props.asOf),
      }
      return [{ employeeId: assignment.managerEmployeeId, evidence }]
    })
  }

  const responsibilities = [...props.statesByEmployee.values()]
    .flatMap((state) => state.responsibilities)
    .toSorted(compareResponsibilities)
  if (props.criterion.kind === "subject_organization_manager") {
    return subjectAssignments.flatMap((assignment) =>
      responsibilities
        .filter(
          (responsibility) =>
            responsibility.responsibilityType === "MANAGER" &&
            responsibility.organizationUnitId === assignment.organizationUnitId,
        )
        .map((responsibility) => ({
          employeeId: responsibility.employeeId,
          evidence: {
            kind: "organization_manager" as const,
            scope: "subject" as const,
            subjectAssignment: assignmentEvidence(assignment, props.asOf),
            responsibility: responsibilityEvidence(responsibility, props.asOf),
          },
        })),
    )
  }
  if (props.criterion.kind === "target_organization_manager") {
    const { organizationUnitId } = props.criterion
    return responsibilities
      .filter(
        (responsibility) =>
          responsibility.responsibilityType === "MANAGER" &&
          responsibility.organizationUnitId === organizationUnitId,
      )
      .map((responsibility) => ({
        employeeId: responsibility.employeeId,
        evidence: {
          kind: "organization_manager" as const,
          scope: "target" as const,
          subjectAssignment: null,
          responsibility: responsibilityEvidence(responsibility, props.asOf),
        },
      }))
  }
  if (props.criterion.kind === "responsibility") {
    const { organizationUnitId, responsibilityType } = props.criterion
    return responsibilities
      .filter(
        (responsibility) =>
          responsibility.responsibilityType === responsibilityType &&
          (organizationUnitId === null || responsibility.organizationUnitId === organizationUnitId),
      )
      .map((responsibility) => ({
        employeeId: responsibility.employeeId,
        evidence: {
          kind: "responsibility" as const,
          responsibility: responsibilityEvidence(responsibility, props.asOf),
        },
      }))
  }
  if (props.subjectEmployeeId === null) return []
  return managementChainCandidates({
    statesByEmployee: props.statesByEmployee,
    subjectEmployeeId: props.subjectEmployeeId,
    asOf: props.asOf,
  })
}

/** Companyの固定済みWorkforce projectionだけから組織上の判断候補を解決する。 */
export function resolveOrganizationalAuthority(
  projection: OrganizationalAuthorityProjection,
): OrganizationalAuthorityResolution | OrganizationalAuthorityError {
  const projectionError = validateProjection(projection)
  if (projectionError !== null) return projectionError

  const states: WorkforceStateValue[] = []
  for (const props of projection.states) {
    const state = WorkforceStateValue.restore(props)
    if (!(state instanceof WorkforceStateValue)) {
      return error("organizational_authority_period_invalid")
    }
    states.push(state)
  }
  const statesByEmployee = new Map(states.map((state) => [state.employeeId, state]))
  const linksByEmployee = new Map<EmployeeId, AccountEmployeeLink>()
  for (const link of projection.accountLinks) linksByEmployee.set(link.employeeId, link)
  const candidates: OrganizationalAuthorityCandidate[] = []

  for (const [criterionIndex, criterion] of projection.criteria.entries()) {
    for (const candidate of resolveCriterion({
      criterion,
      statesByEmployee,
      subjectEmployeeId: projection.subjectEmployeeId,
      asOf: projection.snapshot.asOf,
    })) {
      if (candidate.employeeId === projection.subjectEmployeeId) continue
      const state = statesByEmployee.get(candidate.employeeId)
      const link = linksByEmployee.get(candidate.employeeId)
      if (state === undefined || !state.isEligible || link === undefined) continue
      candidates.push({
        employeeId: candidate.employeeId,
        accountId: link.accountId,
        qualification: { criterionIndex, evidence: candidate.evidence },
      })
    }
  }

  return { snapshot: projection.snapshot, candidates }
}
