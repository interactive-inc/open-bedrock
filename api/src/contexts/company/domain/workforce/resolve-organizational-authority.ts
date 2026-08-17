import { periodContainsDate } from "@/contexts/company/domain/workforce/effective-period"
import { isCalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import { OrganizationalAuthorityError } from "@/contexts/company/domain/workforce/organizational-authority-error"
import type {
  OrganizationalAuthorityAssignmentEvidence,
  OrganizationalAuthorityCandidate,
  OrganizationalAuthorityCriterion,
  OrganizationalAuthorityEvidence,
  OrganizationalAuthorityManagementEdgeEvidence,
  OrganizationalAuthorityProjection,
  OrganizationalAuthorityResolution,
  OrganizationalAuthorityResponsibilityEvidence,
} from "@/contexts/company/domain/workforce/organizational-authority"
import type { WorkforceStateAt } from "@/contexts/company/domain/workforce/resolve-workforce-state"
import type {
  AccountEmployeeLink,
  OrgAssignmentPeriod,
  OrgResponsibilityPeriod,
  WorkforcePeriodVersion,
} from "@/contexts/company/domain/workforce/workforce-schedule"
import { isOrgResponsibilityType } from "@/contexts/company/domain/workforce/workforce-schedule"
import type { EmployeeId } from "@/contexts/company/domain/workforce/workforce-id"

type CandidateEvidence = Readonly<{
  employeeId: EmployeeId
  evidence: OrganizationalAuthorityEvidence
}>

function invalid(code: ConstructorParameters<typeof OrganizationalAuthorityError>[0]) {
  return new OrganizationalAuthorityError(code)
}

function isEligible(state: WorkforceStateAt): boolean {
  return state.employmentId !== null && (state.status === "ACTIVE" || state.status === "ON_LEAVE")
}

function assignments(state: WorkforceStateAt): ReadonlyArray<OrgAssignmentPeriod> {
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
  return {
    ...assignmentEvidence(assignment, asOf),
    managerEmployeeId,
  }
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

function validateProjection(
  projection: OrganizationalAuthorityProjection,
): OrganizationalAuthorityError | null {
  const revision = projection.snapshot.organizationRevision
  if (
    (projection.snapshot.source === "legacy" && revision !== null) ||
    (projection.snapshot.source === "lifecycle" &&
      (revision === null || !Number.isSafeInteger(revision) || revision < 0))
  ) {
    return invalid("organizational_authority_snapshot_invalid")
  }

  const statesByEmployee = new Map<EmployeeId, WorkforceStateAt>()
  const periodIds = new Set<string>()
  for (const state of projection.states) {
    if (statesByEmployee.has(state.employeeId)) {
      return invalid("organizational_authority_employee_duplicate")
    }
    statesByEmployee.set(state.employeeId, state)

    if (state.asOf !== projection.snapshot.asOf) {
      return invalid("organizational_authority_state_as_of_mismatch")
    }
    const hasEligibleStatus = state.status === "ACTIVE" || state.status === "ON_LEAVE"
    if (
      hasEligibleStatus !== (state.employmentId !== null) ||
      (!isEligible(state) &&
        (state.primaryAssignment !== null ||
          state.concurrentAssignments.length > 0 ||
          state.responsibilities.length > 0))
    ) {
      return invalid("organizational_authority_state_invalid")
    }

    for (const assignment of assignments(state)) {
      if (
        state.employmentId === null ||
        assignment.employeeId !== state.employeeId ||
        assignment.employmentId !== state.employmentId ||
        !isCanonicalPeriod(assignment) ||
        assignment.isVoid ||
        !periodContainsDate(assignment, projection.snapshot.asOf) ||
        (assignment === state.primaryAssignment && assignment.assignmentType !== "PRIMARY") ||
        (assignment !== state.primaryAssignment && assignment.assignmentType !== "CONCURRENT")
      ) {
        return invalid("organizational_authority_period_invalid")
      }
      if (periodIds.has(assignment.periodId)) {
        return invalid("organizational_authority_period_duplicate")
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
        !periodContainsDate(responsibility, projection.snapshot.asOf) ||
        !assignments(state).some(
          (assignment) => assignment.organizationUnitId === responsibility.organizationUnitId,
        )
      ) {
        return invalid("organizational_authority_period_invalid")
      }
      if (periodIds.has(responsibility.periodId)) {
        return invalid("organizational_authority_period_duplicate")
      }
      periodIds.add(responsibility.periodId)
    }
  }

  if (
    projection.subjectEmployeeId !== null &&
    !statesByEmployee.has(projection.subjectEmployeeId)
  ) {
    return invalid("organizational_authority_subject_missing")
  }
  for (const criterion of projection.criteria) {
    if (criterion.kind === "employee" && !statesByEmployee.has(criterion.employeeId)) {
      return invalid("organizational_authority_employee_reference_missing")
    }
    if (
      criterion.kind === "responsibility" &&
      !isOrgResponsibilityType(criterion.responsibilityType)
    ) {
      return invalid("organizational_authority_period_invalid")
    }
  }
  for (const state of projection.states) {
    for (const assignment of assignments(state)) {
      if (assignment.managerEmployeeId === null) continue
      const manager = statesByEmployee.get(assignment.managerEmployeeId)
      if (manager === undefined) {
        return invalid("organizational_authority_employee_reference_missing")
      }
      if (!isEligible(manager)) return invalid("organizational_authority_state_invalid")
    }
  }

  const linkedEmployees = new Set<EmployeeId>()
  const linkedAccounts = new Set<string>()
  for (const link of projection.accountLinks) {
    if (!statesByEmployee.has(link.employeeId)) {
      return invalid("organizational_authority_account_employee_missing")
    }
    if (linkedEmployees.has(link.employeeId)) {
      return invalid("organizational_authority_account_employee_duplicate")
    }
    if (linkedAccounts.has(link.accountId)) {
      return invalid("organizational_authority_account_duplicate")
    }
    linkedEmployees.add(link.employeeId)
    linkedAccounts.add(link.accountId)
  }

  return hasManagementCycle(projection.states)
    ? invalid("organizational_authority_manager_cycle")
    : null
}

function hasManagementCycle(states: ReadonlyArray<WorkforceStateAt>): boolean {
  const managersByEmployee = new Map<EmployeeId, ReadonlyArray<EmployeeId>>()
  for (const state of states) {
    const managers = assignments(state)
      .flatMap((assignment) =>
        assignment.managerEmployeeId === null ? [] : [assignment.managerEmployeeId],
      )
      .toSorted()
    managersByEmployee.set(state.employeeId, managers)
  }

  const visiting = new Set<EmployeeId>()
  const visited = new Set<EmployeeId>()
  const visit = (employeeId: EmployeeId): boolean => {
    if (visiting.has(employeeId)) return true
    if (visited.has(employeeId)) return false

    visiting.add(employeeId)
    for (const managerEmployeeId of managersByEmployee.get(employeeId) ?? []) {
      if (visit(managerEmployeeId)) return true
    }
    visiting.delete(employeeId)
    visited.add(employeeId)
    return false
  }

  return [...managersByEmployee.keys()].toSorted().some(visit)
}

function resolveCriterion(props: {
  criterion: OrganizationalAuthorityCriterion
  statesByEmployee: ReadonlyMap<EmployeeId, WorkforceStateAt>
  subjectEmployeeId: EmployeeId | null
  asOf: OrganizationalAuthorityProjection["snapshot"]["asOf"]
}): ReadonlyArray<CandidateEvidence> {
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
    subject === undefined ? [] : assignments(subject).toSorted(compareAssignments)

  if (props.criterion.kind === "direct_manager") {
    return subjectAssignments.flatMap((assignment) => {
      const managerEmployeeId = assignment.managerEmployeeId
      if (managerEmployeeId === null) return []
      const evidence: OrganizationalAuthorityEvidence = {
        kind: "direct_manager",
        assignment: managementEdgeEvidence(assignment, managerEmployeeId, props.asOf),
      }

      return [
        {
          employeeId: managerEmployeeId,
          evidence,
        },
      ]
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
        .map(
          (responsibility): CandidateEvidence => ({
            employeeId: responsibility.employeeId,
            evidence: {
              kind: "organization_manager",
              scope: "subject",
              subjectAssignment: assignmentEvidence(assignment, props.asOf),
              responsibility: responsibilityEvidence(responsibility, props.asOf),
            },
          }),
        ),
    )
  }
  if (props.criterion.kind === "target_organization_manager") {
    const targetOrganizationUnitId = props.criterion.organizationUnitId

    return responsibilities
      .filter(
        (responsibility) =>
          responsibility.responsibilityType === "MANAGER" &&
          responsibility.organizationUnitId === targetOrganizationUnitId,
      )
      .map(
        (responsibility): CandidateEvidence => ({
          employeeId: responsibility.employeeId,
          evidence: {
            kind: "organization_manager",
            scope: "target",
            subjectAssignment: null,
            responsibility: responsibilityEvidence(responsibility, props.asOf),
          },
        }),
      )
  }

  const criterion = props.criterion
  if (criterion.kind === "responsibility") {
    return responsibilities
      .filter(
        (responsibility) =>
          responsibility.responsibilityType === criterion.responsibilityType &&
          (criterion.organizationUnitId === null ||
            responsibility.organizationUnitId === criterion.organizationUnitId),
      )
      .map(
        (responsibility): CandidateEvidence => ({
          employeeId: responsibility.employeeId,
          evidence: {
            kind: "responsibility",
            responsibility: responsibilityEvidence(responsibility, props.asOf),
          },
        }),
      )
  }

  if (props.subjectEmployeeId === null) return []

  return managementChainCandidates({
    statesByEmployee: props.statesByEmployee,
    subjectEmployeeId: props.subjectEmployeeId,
    asOf: props.asOf,
  })
}

function managementChainCandidates(props: {
  statesByEmployee: ReadonlyMap<EmployeeId, WorkforceStateAt>
  subjectEmployeeId: EmployeeId
  asOf: OrganizationalAuthorityProjection["snapshot"]["asOf"]
}): ReadonlyArray<CandidateEvidence> {
  const edgesByEmployee = new Map<
    EmployeeId,
    ReadonlyArray<OrganizationalAuthorityManagementEdgeEvidence>
  >()
  for (const state of props.statesByEmployee.values()) {
    const managementEdges: OrganizationalAuthorityManagementEdgeEvidence[] = []
    for (const assignment of assignments(state).toSorted(compareAssignments)) {
      if (assignment.managerEmployeeId === null) continue
      managementEdges.push(
        managementEdgeEvidence(assignment, assignment.managerEmployeeId, props.asOf),
      )
    }
    edgesByEmployee.set(state.employeeId, managementEdges)
  }

  const pending = (edgesByEmployee.get(props.subjectEmployeeId) ?? []).map((edge) => ({
    employeeId: edge.managerEmployeeId,
    path: [edge],
  }))
  const visited = new Set<EmployeeId>([props.subjectEmployeeId])
  const candidates: CandidateEvidence[] = []

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

/** Companyの固定済みWorkforce projectionだけから組織上の判断候補を解決する。 */
export function resolveOrganizationalAuthority(
  projection: OrganizationalAuthorityProjection,
): OrganizationalAuthorityResolution | OrganizationalAuthorityError {
  const projectionError = validateProjection(projection)
  if (projectionError !== null) return projectionError

  const statesByEmployee = new Map(projection.states.map((state) => [state.employeeId, state]))
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
      const link: AccountEmployeeLink | undefined = linksByEmployee.get(candidate.employeeId)
      if (state === undefined || !isEligible(state) || link === undefined) continue

      candidates.push({
        employeeId: candidate.employeeId,
        accountId: link.accountId,
        qualification: { criterionIndex, evidence: candidate.evidence },
      })
    }
  }

  return { snapshot: projection.snapshot, candidates }
}
