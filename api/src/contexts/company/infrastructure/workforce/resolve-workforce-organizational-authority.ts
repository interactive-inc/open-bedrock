import type {
  OrganizationalAuthorityCandidateResolution,
  OrganizationalAuthorityCriterion as LegacyCriterion,
  OrganizationalAuthoritySnapshot as LegacySnapshot,
} from "@/contexts/company/domain/organization/organizational-authority-candidate"
import {
  toWorkforceEmployeeId,
  toWorkforceOrganizationUnitId,
} from "@/contexts/company/domain/employee-lifecycle/to-workforce-lifecycle-schedules"
import { restoreCalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import { OrganizationalAuthorityError } from "@/contexts/company/domain/workforce/organizational-authority-error"
import type {
  OrganizationalAuthorityCriterion,
  OrganizationalAuthorityEvidence,
} from "@/contexts/company/domain/workforce/organizational-authority"
import { resolveOrganizationalAuthority } from "@/contexts/company/domain/workforce/resolve-organizational-authority"
import type { WorkforceStateAt } from "@/contexts/company/domain/workforce/resolve-workforce-state"
import type {
  AccountEmployeeLink,
  OrgAssignmentPeriod,
  OrgResponsibilityPeriod,
} from "@/contexts/company/domain/workforce/workforce-schedule"
import {
  restoreWorkforceId,
  type EmployeeId,
  type EmploymentId,
  type WorkforcePeriodId,
} from "@/contexts/company/domain/workforce/workforce-id"
import type { AccountId } from "@system/domain/auth/account-id"

export type WorkforceAuthorityEmployeeRow = Readonly<{
  id: number
  code: string | null
  status: string
  archivedAt: number | null
}>

export type WorkforceAuthorityMembership = Readonly<{
  employeeCode: string
  departmentCode: string
  managerEmployeeCode: string | null
  evidence: Readonly<Record<string, unknown>>
}>

export type WorkforceAuthorityResponsibility = Readonly<{
  code: string
  managerEmployeeCode: string
  evidence: Readonly<Record<string, unknown>>
}>

export type WorkforceAuthorityOrganizationProjection = Readonly<{
  memberships: ReadonlyArray<WorkforceAuthorityMembership>
  departments: ReadonlyArray<WorkforceAuthorityResponsibility>
  liveEmployeeIds: ReadonlySet<number>
  organizationRevision: number | null
}>

export type WorkforceAuthorityAccountRow = Readonly<{
  legacyId: number
  systemId: AccountId
  employeeId: number | null
}>

type Props = Readonly<{
  snapshot: LegacySnapshot
  criteria: ReadonlyArray<LegacyCriterion>
  employeeRows: ReadonlyArray<WorkforceAuthorityEmployeeRow>
  organization: WorkforceAuthorityOrganizationProjection
  accountRows: ReadonlyArray<WorkforceAuthorityAccountRow>
  subjectEmployeeId: number | null
  targetDepartmentCode: string | null
}>

type BuiltProjection = Readonly<{
  criteria: ReadonlyArray<OrganizationalAuthorityCriterion>
  criterionIndexes: ReadonlyArray<number>
  states: ReadonlyArray<WorkforceStateAt>
  accountLinks: ReadonlyArray<AccountEmployeeLink>
  evidenceByPeriodId: ReadonlyMap<WorkforcePeriodId, Readonly<Record<string, unknown>>>
  employeeRowsById: ReadonlyMap<EmployeeId, WorkforceAuthorityEmployeeRow>
}>

type CanonicalCriteria = Readonly<{
  criteria: ReadonlyArray<OrganizationalAuthorityCriterion>
  indexes: ReadonlyArray<number>
}>

function employeeId(value: number): EmployeeId {
  return toWorkforceEmployeeId(value)
}

function employmentId(value: number): EmploymentId {
  return restoreWorkforceId("employment", `authority-employment:${value}`)
}

function recordedByActionId() {
  return restoreWorkforceId("personnel_action", "authority-snapshot")
}

function periodBase(periodId: WorkforcePeriodId, revision: number, asOf: string) {
  return {
    periodId,
    revision,
    startsOn: restoreCalendarDate(asOf),
    endsOn: null,
    isVoid: false,
    recordedByActionId: recordedByActionId(),
    recordedAt: 0,
  }
}

function evidenceRevision(evidence: Readonly<Record<string, unknown>>): number {
  const revision = evidence.employee_revision

  return typeof revision === "number" && Number.isSafeInteger(revision) && revision >= 1
    ? revision
    : 1
}

function toCriteria(props: Props): CanonicalCriteria | Error {
  const employeeIdsByCode = new Map(
    props.employeeRows.flatMap((employee) =>
      employee.code === null ? [] : [[employee.code, employeeId(employee.id)]],
    ),
  )
  const criteria: OrganizationalAuthorityCriterion[] = []
  const indexes: number[] = []

  for (const [criterionIndex, criterion] of props.criteria.entries()) {
    if (criterion.kind === "legacy_account_role") continue
    if (criterion.kind === "employee") {
      const resolvedEmployeeId = employeeIdsByCode.get(criterion.employeeCode)
      if (resolvedEmployeeId === undefined) {
        return new OrganizationalAuthorityError(
          "organizational_authority_employee_reference_missing",
        )
      }
      criteria.push({ kind: "employee", employeeId: resolvedEmployeeId })
      indexes.push(criterionIndex)
      continue
    }
    if (criterion.kind === "department_manager") {
      criteria.push({ kind: "subject_organization_manager" })
      indexes.push(criterionIndex)
      continue
    }
    if (criterion.kind === "target_department_manager") {
      if (props.targetDepartmentCode === null) {
        return new Error("target organization is required for its manager criterion")
      }
      criteria.push({
        kind: "target_organization_manager",
        organizationUnitId: toWorkforceOrganizationUnitId(props.targetDepartmentCode),
      })
      indexes.push(criterionIndex)
      continue
    }
    criteria.push(criterion)
    indexes.push(criterionIndex)
  }

  return { criteria, indexes }
}

function buildProjection(props: Props): BuiltProjection | Error {
  try {
    const asOf = restoreCalendarDate(props.snapshot.asOf)
    const employeesByCode = new Map(
      props.employeeRows.flatMap((employee) =>
        employee.code === null ? [] : [[employee.code, employee]],
      ),
    )
    const codedEmployeeCount = props.employeeRows.filter(
      (employee) => employee.code !== null,
    ).length
    if (employeesByCode.size !== codedEmployeeCount) {
      return new OrganizationalAuthorityError("organizational_authority_employee_duplicate")
    }
    const employeeIds = new Set(props.employeeRows.map((employee) => employee.id))
    for (const liveEmployeeId of props.organization.liveEmployeeIds) {
      if (!employeeIds.has(liveEmployeeId)) {
        return new OrganizationalAuthorityError(
          "organizational_authority_employee_reference_missing",
        )
      }
    }
    for (const membership of props.organization.memberships) {
      if (
        !employeesByCode.has(membership.employeeCode) ||
        (membership.managerEmployeeCode !== null &&
          !employeesByCode.has(membership.managerEmployeeCode))
      ) {
        return new OrganizationalAuthorityError(
          "organizational_authority_employee_reference_missing",
        )
      }
    }
    for (const responsibility of props.organization.departments) {
      if (!employeesByCode.has(responsibility.managerEmployeeCode)) {
        return new OrganizationalAuthorityError(
          "organizational_authority_employee_reference_missing",
        )
      }
    }
    const canonicalCriteria = toCriteria(props)
    if (canonicalCriteria instanceof Error) return canonicalCriteria
    const evidenceByPeriodId = new Map<WorkforcePeriodId, Readonly<Record<string, unknown>>>()
    const sortedMemberships = props.organization.memberships.toSorted(
      (left, right) =>
        left.employeeCode.localeCompare(right.employeeCode) ||
        left.departmentCode.localeCompare(right.departmentCode) ||
        String(left.managerEmployeeCode).localeCompare(String(right.managerEmployeeCode)),
    )
    const membershipIndex = new Map<WorkforceAuthorityMembership, number>()
    for (const [index, membership] of sortedMemberships.entries()) {
      membershipIndex.set(membership, index)
    }
    const sortedResponsibilities = props.organization.departments.toSorted(
      (left, right) =>
        left.managerEmployeeCode.localeCompare(right.managerEmployeeCode) ||
        left.code.localeCompare(right.code),
    )
    const responsibilityIndex = new Map<WorkforceAuthorityResponsibility, number>()
    for (const [index, responsibility] of sortedResponsibilities.entries()) {
      responsibilityIndex.set(responsibility, index)
    }
    const states: WorkforceStateAt[] = []

    for (const employee of props.employeeRows.toSorted((left, right) => left.id - right.id)) {
      const workforceEmployeeId = employeeId(employee.id)
      const isLive = props.organization.liveEmployeeIds.has(employee.id)
      const workforceEmploymentId = isLive ? employmentId(employee.id) : null
      const employeeMemberships =
        employee.code === null
          ? []
          : sortedMemberships.filter((membership) => membership.employeeCode === employee.code)
      const assignmentPeriods: OrgAssignmentPeriod[] = []

      for (const [index, membership] of employeeMemberships.entries()) {
        const globalIndex = membershipIndex.get(membership)
        if (globalIndex === undefined || workforceEmploymentId === null) continue
        const manager =
          membership.managerEmployeeCode === null
            ? null
            : employeesByCode.get(membership.managerEmployeeCode)
        if (membership.managerEmployeeCode !== null && manager === undefined) {
          return new OrganizationalAuthorityError(
            "organizational_authority_employee_reference_missing",
          )
        }
        const periodId = restoreWorkforceId("period", `authority-assignment:${globalIndex}`)
        evidenceByPeriodId.set(periodId, membership.evidence)
        assignmentPeriods.push({
          ...periodBase(periodId, evidenceRevision(membership.evidence), props.snapshot.asOf),
          employmentId: workforceEmploymentId,
          employeeId: workforceEmployeeId,
          organizationUnitId: toWorkforceOrganizationUnitId(membership.departmentCode),
          assignmentType: index === 0 ? "PRIMARY" : "CONCURRENT",
          positionTitle: null,
          managerEmployeeId: manager == null ? null : employeeId(manager.id),
        })
      }

      const responsibilityPeriods: OrgResponsibilityPeriod[] = []
      if (employee.code !== null && workforceEmploymentId !== null) {
        for (const responsibility of sortedResponsibilities.filter(
          (candidate) => candidate.managerEmployeeCode === employee.code,
        )) {
          const globalIndex = responsibilityIndex.get(responsibility)
          if (globalIndex === undefined) continue
          const periodId = restoreWorkforceId("period", `authority-responsibility:${globalIndex}`)
          const organizationUnitId = toWorkforceOrganizationUnitId(responsibility.code)
          if (
            !assignmentPeriods.some(
              (assignment) => assignment.organizationUnitId === organizationUnitId,
            )
          ) {
            const assignmentPeriodId = restoreWorkforceId(
              "period",
              `authority-responsibility-assignment:${globalIndex}`,
            )
            evidenceByPeriodId.set(assignmentPeriodId, responsibility.evidence)
            assignmentPeriods.push({
              ...periodBase(
                assignmentPeriodId,
                evidenceRevision(responsibility.evidence),
                props.snapshot.asOf,
              ),
              employmentId: workforceEmploymentId,
              employeeId: workforceEmployeeId,
              organizationUnitId,
              assignmentType: assignmentPeriods.length === 0 ? "PRIMARY" : "CONCURRENT",
              positionTitle: null,
              managerEmployeeId: null,
            })
          }
          evidenceByPeriodId.set(periodId, responsibility.evidence)
          responsibilityPeriods.push({
            ...periodBase(periodId, evidenceRevision(responsibility.evidence), props.snapshot.asOf),
            employmentId: workforceEmploymentId,
            employeeId: workforceEmployeeId,
            organizationUnitId,
            responsibilityType: "MANAGER",
          })
        }
      }

      states.push({
        employeeId: workforceEmployeeId,
        asOf,
        status: isLive ? "ACTIVE" : "TERMINATED",
        employmentId: workforceEmploymentId,
        primaryAssignment: assignmentPeriods[0] ?? null,
        concurrentAssignments: assignmentPeriods.slice(1),
        responsibilities: responsibilityPeriods,
      })
    }

    const accountLinks = props.accountRows.flatMap(
      (account): ReadonlyArray<AccountEmployeeLink> =>
        account.employeeId === null
          ? []
          : [
              {
                employeeId: employeeId(account.employeeId),
                accountId: restoreWorkforceId("system_account", account.systemId),
              },
            ],
    )

    return {
      criteria: canonicalCriteria.criteria,
      criterionIndexes: canonicalCriteria.indexes,
      states,
      accountLinks,
      evidenceByPeriodId,
      employeeRowsById: new Map(
        props.employeeRows.map((employee) => [employeeId(employee.id), employee]),
      ),
    }
  } catch (cause) {
    return cause instanceof Error ? cause : new Error("authority projection is invalid", { cause })
  }
}

function legacyEvidence(props: {
  evidence: OrganizationalAuthorityEvidence
  criterion: LegacyCriterion
  evidenceByPeriodId: ReadonlyMap<WorkforcePeriodId, Readonly<Record<string, unknown>>>
}): Readonly<Record<string, unknown>> | Error {
  if (props.evidence.kind === "employee") {
    if (props.criterion.kind !== "employee") return new Error("authority criterion drifted")

    return { type: "employee_code", employee_code: props.criterion.employeeCode }
  }
  if (props.evidence.kind === "direct_manager") {
    return (
      props.evidenceByPeriodId.get(props.evidence.assignment.assignmentPeriodId) ??
      new Error("authority assignment evidence is missing")
    )
  }
  if (props.evidence.kind === "organization_manager") {
    return (
      props.evidenceByPeriodId.get(props.evidence.responsibility.responsibilityPeriodId) ??
      new Error("authority responsibility evidence is missing")
    )
  }

  const path: Readonly<Record<string, unknown>>[] = []
  for (const edge of props.evidence.path) {
    const evidence = props.evidenceByPeriodId.get(edge.assignmentPeriodId)
    if (evidence === undefined) return new Error("authority management evidence is missing")
    path.push(evidence)
  }

  return { type: "management_chain", path }
}

/** 現行D1 projectionを共通の純粋resolverへ写し、既存内部wireへ損失なく戻す。 */
export function resolveWorkforceOrganizationalAuthority(
  props: Props,
): OrganizationalAuthorityCandidateResolution | Error {
  const built = buildProjection(props)
  if (built instanceof Error) return built
  const result = resolveOrganizationalAuthority({
    snapshot: {
      schemaVersion: 1,
      source: props.snapshot.source,
      asOf: restoreCalendarDate(props.snapshot.asOf),
      organizationRevision: props.organization.organizationRevision,
    },
    subjectEmployeeId:
      props.subjectEmployeeId === null ? null : employeeId(props.subjectEmployeeId),
    criteria: built.criteria,
    states: built.states,
    accountLinks: built.accountLinks,
  })
  if (result instanceof Error) return result

  const candidates: OrganizationalAuthorityCandidateResolution["candidates"][number][] = []
  for (const candidate of result.candidates) {
    const employee = built.employeeRowsById.get(candidate.employeeId)
    const originalCriterionIndex = built.criterionIndexes[candidate.qualification.criterionIndex]
    const criterion =
      originalCriterionIndex === undefined ? undefined : props.criteria[originalCriterionIndex]
    const account = props.accountRows.find(
      (row) =>
        row.employeeId === employee?.id && String(row.systemId) === String(candidate.accountId),
    )
    if (employee === undefined || criterion === undefined || account === undefined) {
      return new Error("canonical authority candidate cannot be mapped to legacy storage")
    }
    const evidence = legacyEvidence({
      evidence: candidate.qualification.evidence,
      criterion,
      evidenceByPeriodId: built.evidenceByPeriodId,
    })
    if (evidence instanceof Error) return evidence

    candidates.push({
      employeeId: employee.id,
      accountId: account.systemId,
      qualification: {
        criterionIndex: originalCriterionIndex,
        evidence: { ...evidence, system_account_id: account.systemId },
      },
    })
  }

  return { snapshot: props.snapshot, candidates }
}
