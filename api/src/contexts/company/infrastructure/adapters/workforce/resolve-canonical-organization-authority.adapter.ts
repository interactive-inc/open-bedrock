import { ResolveOrganizationAuthority } from "@/contexts/company/lib/workforce/resolve-organization-authority"
import { WorkforceSnapshotChangedError } from "@/contexts/company/domain/errors"
import type {
  OrganizationalAuthorityCandidateResolution,
  OrganizationalAuthorityCriterion as ProcedureCriterion,
} from "@/contexts/company/domain/definitions/organizational-authority-candidate.definition"
import type {
  OrganizationalAuthorityCriterion,
  OrganizationalAuthorityEvidence,
} from "@/contexts/company/domain/definitions/organizational-authority.definition"
import { toWorkforceOrganizationUnitId } from "@/contexts/company/domain/definitions/to-workforce-organization-unit-id.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { restoreOrgResponsibilityType } from "@/contexts/company/domain/definitions/restore-org-responsibility-type.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { OrganizationUnitReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-unit-read.adapter"
import { OrganizationWorkforceSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-workforce-snapshot.adapter"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import {
  CompanyOperationError,
  CompanyConflictError,
  CompanyUnexpectedError,
} from "@/contexts/company/domain/errors"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"

type EmployeeRow = Readonly<{ id: EmployeeId; code: string | null }>

type CanonicalCriteria = Readonly<{
  criteria: ReadonlyArray<OrganizationalAuthorityCriterion>
  indexes: ReadonlyArray<number>
}>

function toCriteria(props: {
  criteria: ReadonlyArray<ProcedureCriterion>
  employeeRows: ReadonlyArray<EmployeeRow>
  targetDepartmentCode: string | null
}): CanonicalCriteria | CompanyOperationError {
  const byCode = new Map(
    props.employeeRows.flatMap((employee) =>
      employee.code === null ? [] : [[employee.code, employee.id]],
    ),
  )
  const criteria: OrganizationalAuthorityCriterion[] = []
  const indexes: number[] = []

  for (const [index, criterion] of props.criteria.entries()) {
    if (criterion.kind === "technical_role") continue
    if (criterion.kind === "employee") {
      const employeeId = byCode.get(criterion.employeeCode)
      if (employeeId === undefined) {
        return new CompanyConflictError(
          "判断資格の従業員を解決できません",
          "organizational_authority_employee_reference_missing",
        )
      }
      criteria.push({ kind: "employee", employeeId })
    } else if (criterion.kind === "department_manager") {
      criteria.push({ kind: "subject_organization_manager" })
    } else if (criterion.kind === "target_department_manager") {
      if (props.targetDepartmentCode === null) {
        return new CompanyConflictError(
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
        responsibilityType: restoreOrgResponsibilityType(criterion.responsibilityType),
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
async function resolveCanonicalOrganizationAuthority(props: {
  c: CompanyContext
  subjectEmployeeId: EmployeeId | null
  criteria: ReadonlyArray<ProcedureCriterion>
  employeeRows: ReadonlyArray<EmployeeRow>
  targetDepartmentCode: string | null
  asOf: string
}): Promise<OrganizationalAuthorityCandidateResolution | CompanyOperationError> {
  const canonicalCriteria = toCriteria(props)
  if (canonicalCriteria instanceof CompanyOperationError) return canonicalCriteria

  const result = await new ResolveOrganizationAuthority({
    organization: new OrganizationUnitReadAdapter(props.c.var.database),
    workforce: new OrganizationWorkforceSnapshotAdapter(props.c),
  }).execute({
    subjectEmployeeId: props.subjectEmployeeId,
    criteria: canonicalCriteria.criteria,
    asOf: restoreCalendarDate(props.asOf),
  })

  if (result.kind === "unavailable") {
    if (result.cause instanceof WorkforceSnapshotChangedError) {
      return new CompanyConflictError(
        "組織 revision が変化したため判断資格を固定できません",
        "organization_revision_conflict",
        { cause: result.cause },
      )
    }
    return new CompanyUnexpectedError("組織資格のsnapshotを固定できません", { cause: result.cause })
  }
  if (result.kind === "invalid") {
    return new CompanyConflictError(
      "組織投影が不整合なため判断資格を固定できません",
      "code" in result.error ? String(result.error.code) : "lifecycle_projection_mismatch",
      { cause: result.error },
    )
  }

  const candidates: OrganizationalAuthorityCandidateResolution["candidates"][number][] = []
  for (const candidate of result.resolution.candidates) {
    const criterionIndex = canonicalCriteria.indexes[candidate.qualification.criterionIndex]
    if (criterionIndex === undefined) {
      return new CompanyUnexpectedError("組織資格の条件を解決できません")
    }
    candidates.push({
      employeeId: candidate.employeeId,
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
type ResolveCanonicalOrganizationAuthorityAdapterContext = {
  c: CompanyContext
  subjectEmployeeId: EmployeeId | null
  criteria: ReadonlyArray<ProcedureCriterion>
  employeeRows: ReadonlyArray<EmployeeRow>
  targetDepartmentCode: string | null
  asOf: string
}
type Context = ResolveCanonicalOrganizationAuthorityAdapterContext

export class ResolveCanonicalOrganizationAuthorityAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async resolveCanonicalOrganizationAuthority(): Promise<
    OrganizationalAuthorityCandidateResolution | CompanyOperationError
  > {
    return resolveCanonicalOrganizationAuthority(this.c)
  }
}
