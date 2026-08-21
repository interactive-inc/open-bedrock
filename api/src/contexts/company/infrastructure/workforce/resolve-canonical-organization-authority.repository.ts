import { ResolveOrganizationAuthority } from "@/contexts/company/infrastructure/workforce/resolve-organization-authority.repository"
import { WorkforceSnapshotChangedError } from "@/contexts/company/domain/workforce/workforce-snapshot-changed-error"
import type {
  OrganizationalAuthorityCandidateResolution,
  OrganizationalAuthorityCriterion as LegacyCriterion,
} from "@/contexts/company/domain/organization/organizational-authority-candidate"
import type {
  OrganizationalAuthorityCriterion,
  OrganizationalAuthorityEvidence,
} from "@/contexts/company/domain/workforce/organizational-authority"
import {
  toWorkforceEmployeeId,
  toWorkforceOrganizationUnitId,
} from "@/contexts/company/domain/employee-lifecycle/to-workforce-lifecycle-schedules"
import { restoreCalendarDate } from "@/contexts/company/domain/workforce/restore-calendar-date"
import type { EmployeeId } from "@/contexts/company/domain/workforce/workforce-id"
import { OrganizationUnitReadRepository } from "@/contexts/company/infrastructure/workforce/organization-unit-read.repository"
import { OrganizationWorkforceSnapshotRepository } from "@/contexts/company/infrastructure/workforce/organization-workforce-snapshot.repository"
import type { Context } from "@/env"
import { ApplicationError, ConflictError, UnexpectedError } from "@/lib/errors"
import { zAccountId } from "@system/domain/values/account-id.schema"

type EmployeeRow = Readonly<{ id: number; code: string | null }>

type CanonicalCriteria = Readonly<{
  criteria: ReadonlyArray<OrganizationalAuthorityCriterion>
  indexes: ReadonlyArray<number>
}>

function toCriteria(props: {
  criteria: ReadonlyArray<LegacyCriterion>
  employeeRows: ReadonlyArray<EmployeeRow>
  targetDepartmentCode: string | null
}): CanonicalCriteria | ApplicationError {
  const byCode = new Map(
    props.employeeRows.flatMap((employee) =>
      employee.code === null ? [] : [[employee.code, toWorkforceEmployeeId(employee.id)]],
    ),
  )
  const criteria: OrganizationalAuthorityCriterion[] = []
  const indexes: number[] = []

  for (const [index, criterion] of props.criteria.entries()) {
    if (criterion.kind === "legacy_account_role") continue
    if (criterion.kind === "employee") {
      const employeeId = byCode.get(criterion.employeeCode)
      if (employeeId === undefined) {
        return new ConflictError(
          "判断資格の従業員を解決できません",
          "organizational_authority_employee_reference_missing",
        )
      }
      criteria.push({ kind: "employee", employeeId })
    } else if (criterion.kind === "department_manager") {
      criteria.push({ kind: "subject_organization_manager" })
    } else if (criterion.kind === "target_department_manager") {
      if (props.targetDepartmentCode === null) {
        return new ConflictError(
          "対象組織が指定されていません",
          "organizational_authority_organization_reference_missing",
        )
      }
      criteria.push({
        kind: "target_organization_manager",
        organizationUnitId: toWorkforceOrganizationUnitId(props.targetDepartmentCode),
      })
    } else if (criterion.kind === "responsibility") {
      criteria.push({
        kind: "responsibility",
        responsibilityType: criterion.responsibilityType,
        organizationUnitId:
          criterion.organizationUnitCode === null
            ? null
            : toWorkforceOrganizationUnitId(criterion.organizationUnitCode),
      })
    } else {
      criteria.push({ kind: criterion.kind })
    }
    indexes.push(index)
  }

  return { criteria, indexes }
}

function storageEmployeeId(employeeId: EmployeeId): number | Error {
  const match = /^employee:(0|[1-9]\d*)$/.exec(String(employeeId))
  if (match === null) return new Error("canonical Employee ID cannot be mapped to storage")
  const value = Number(match[1])
  return Number.isSafeInteger(value) && value > 0
    ? value
    : new Error("canonical Employee ID cannot be mapped to storage")
}

function evidence(value: OrganizationalAuthorityEvidence): Readonly<Record<string, unknown>> {
  if (value.kind === "employee") {
    return { type: "employee", employee_id: value.employeeId }
  }
  if (value.kind === "direct_manager") {
    return {
      type: "lifecycle_assignment",
      employee_id: value.assignment.employeeId,
      manager_employee_id: value.assignment.managerEmployeeId,
      organization_unit_id: value.assignment.organizationUnitId,
      assignment_period_id: value.assignment.assignmentPeriodId,
      assignment_revision: value.assignment.assignmentRevision,
      as_of: value.assignment.asOf,
    }
  }
  if (value.kind === "organization_manager") {
    return {
      type: "lifecycle_responsibility",
      scope: value.scope,
      subject_assignment: value.subjectAssignment,
      employee_id: value.responsibility.employeeId,
      organization_unit_id: value.responsibility.organizationUnitId,
      responsibility_period_id: value.responsibility.responsibilityPeriodId,
      responsibility_revision: value.responsibility.responsibilityRevision,
      as_of: value.responsibility.asOf,
    }
  }
  if (value.kind === "responsibility") {
    return {
      type: "responsibility",
      employee_id: value.responsibility.employeeId,
      organization_unit_id: value.responsibility.organizationUnitId,
      responsibility_type: value.responsibility.responsibilityType,
      responsibility_period_id: value.responsibility.responsibilityPeriodId,
      responsibility_revision: value.responsibility.responsibilityRevision,
      as_of: value.responsibility.asOf,
    }
  }
  return {
    type: "management_chain",
    path: value.path.map((edge) => ({
      employee_id: edge.employeeId,
      manager_employee_id: edge.managerEmployeeId,
      organization_unit_id: edge.organizationUnitId,
      assignment_period_id: edge.assignmentPeriodId,
      assignment_revision: edge.assignmentRevision,
      as_of: edge.asOf,
    })),
  }
}

/** canonical Company snapshotと共通Application serviceから既存内部wireを構成する。 */
export async function resolveCanonicalOrganizationAuthority(props: {
  c: Context
  subjectEmployeeId: number | null
  criteria: ReadonlyArray<LegacyCriterion>
  employeeRows: ReadonlyArray<EmployeeRow>
  targetDepartmentCode: string | null
  asOf: string
}): Promise<OrganizationalAuthorityCandidateResolution | ApplicationError> {
  const canonicalCriteria = toCriteria(props)
  if (canonicalCriteria instanceof ApplicationError) return canonicalCriteria

  const result = await new ResolveOrganizationAuthority({
    organization: new OrganizationUnitReadRepository(props.c.var.database),
    workforce: new OrganizationWorkforceSnapshotRepository(props.c),
  }).execute({
    subjectEmployeeId:
      props.subjectEmployeeId === null ? null : toWorkforceEmployeeId(props.subjectEmployeeId),
    criteria: canonicalCriteria.criteria,
    asOf: restoreCalendarDate(props.asOf),
  })

  if (result.kind === "unavailable") {
    if (result.cause instanceof WorkforceSnapshotChangedError) {
      return new ConflictError(
        "組織 revision が変化したため判断資格を固定できません",
        "organization_revision_conflict",
        { cause: result.cause },
      )
    }
    return new UnexpectedError("組織資格のsnapshotを固定できません", { cause: result.cause })
  }
  if (result.kind === "invalid") {
    return new ConflictError(
      "組織投影が不整合なため判断資格を固定できません",
      "code" in result.error ? String(result.error.code) : "lifecycle_projection_mismatch",
      { cause: result.error },
    )
  }

  const candidates: OrganizationalAuthorityCandidateResolution["candidates"][number][] = []
  for (const candidate of result.resolution.candidates) {
    const employeeId = storageEmployeeId(candidate.employeeId)
    const criterionIndex = canonicalCriteria.indexes[candidate.qualification.criterionIndex]
    if (employeeId instanceof Error || criterionIndex === undefined) {
      return new UnexpectedError("組織資格を既存APIへ変換できません", { cause: employeeId })
    }
    candidates.push({
      employeeId,
      accountId: zAccountId.parse(String(candidate.accountId)),
      qualification: {
        criterionIndex,
        evidence: {
          ...evidence(candidate.qualification.evidence),
          system_account_id: candidate.accountId,
        },
      },
    })
  }

  return {
    snapshot: {
      schemaVersion: 1,
      source: "lifecycle",
      asOf: result.resolution.snapshot.asOf,
      organizationRevision: result.resolution.snapshot.organizationRevision,
    },
    candidates,
  }
}
