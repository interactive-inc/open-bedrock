import type {
  OrganizationalAuthorityCandidateResolution,
  OrganizationalAuthorityCriterion,
  OrganizationalAuthoritySnapshot,
} from "@/contexts/company/domain/organization/organizational-authority-candidate"
import { OrganizationalAuthorityError } from "@/contexts/company/domain/workforce/organizational-authority-error"
import { EmployeeLifecycleReadRepository } from "@/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle-read-repository"
import { EmployeeLifecycleRepository } from "@/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle-repository"
import {
  resolveWorkforceOrganizationalAuthority,
  type WorkforceAuthorityEmployeeRow,
  type WorkforceAuthorityOrganizationProjection,
} from "@/contexts/company/infrastructure/workforce/resolve-workforce-organizational-authority"
import { resolveCanonicalOrganizationAuthority } from "@/contexts/company/infrastructure/workforce/resolve-canonical-organization-authority"
import { accounts } from "@/api/legacy-system/adapters/schema/system"
import { accountEmployeeLinks, employees } from "@/contexts/company/infrastructure/schema/employee"
import {
  orgDepartments,
  orgMemberships,
} from "@/contexts/company/infrastructure/schema/organization"
import { systemAccounts } from "@system/infrastructure/schema/system-core"
import type { Context } from "@/env"
import { ApplicationError, ConflictError, UnexpectedError } from "@/lib/errors"
import { resolveCompanyBusinessDate } from "@/lib/time/resolve-company-business-date"
import { and, eq, isNull, sql } from "drizzle-orm"

async function resolveSnapshot(
  c: Context,
  resolvedAt: string,
): Promise<OrganizationalAuthoritySnapshot | ApplicationError> {
  const asOf = resolveCompanyBusinessDate({
    now: resolvedAt,
    timeZone: c.env.COMPANY_TIME_ZONE,
  })
  if (typeof asOf !== "string") {
    return new UnexpectedError("判断資格の基準日を解決できません", { cause: asOf })
  }

  const migrationStatus = await new EmployeeLifecycleRepository(c).migrationStatus()
  if (migrationStatus instanceof ApplicationError) return migrationStatus

  if (migrationStatus === "verified") {
    const organizationRevision = await readOrganizationRevision(c)
    if (organizationRevision instanceof ApplicationError) return organizationRevision

    return {
      schemaVersion: 1,
      source: "lifecycle",
      asOf,
      organizationRevision,
    }
  }

  return {
    schemaVersion: 1,
    source: "legacy",
    asOf,
    organizationRevision: null,
  }
}

async function readOrganizationRevision(c: Context): Promise<number | ApplicationError> {
  try {
    return (
      (await c.env.DB.prepare(
        "SELECT revision FROM organization_lifecycle_states WHERE id = 1",
      ).first<number>("revision")) ?? 0
    )
  } catch (cause) {
    return new UnexpectedError("組織 revision を読み出せません", { cause })
  }
}

function revisionConflict(): ConflictError {
  return new ConflictError(
    "組織 revision が変化したため判断資格を固定できません",
    "organization_revision_conflict",
  )
}

async function loadOrganizationProjection(props: {
  c: Context
  employeeRows: ReadonlyArray<WorkforceAuthorityEmployeeRow>
  snapshot: OrganizationalAuthoritySnapshot
}): Promise<WorkforceAuthorityOrganizationProjection | ApplicationError> {
  if (props.snapshot.source === "legacy") {
    try {
      const [memberships, departments] = await Promise.all([
        props.c.var.database.select().from(orgMemberships),
        props.c.var.database.select().from(orgDepartments),
      ])
      return {
        memberships: memberships.map((membership) => ({
          employeeCode: membership.employeeCode,
          departmentCode: membership.departmentCode,
          managerEmployeeCode: membership.managerEmployeeCode,
          evidence: {
            type: "org_membership",
            department_code: membership.departmentCode,
            employee_code: membership.employeeCode,
            manager_employee_code: membership.managerEmployeeCode,
          },
        })),
        departments: departments.flatMap((department) =>
          department.managerEmployeeCode === null || department.archivedAt !== null
            ? []
            : [
                {
                  code: department.code,
                  managerEmployeeCode: department.managerEmployeeCode,
                  evidence: {
                    type: "department_manager",
                    department_code: department.code,
                    manager_employee_code: department.managerEmployeeCode,
                  },
                },
              ],
        ),
        liveEmployeeIds: new Set(
          props.employeeRows
            .filter(
              (employee) =>
                employee.archivedAt === null &&
                (employee.status === "active" || employee.status === "leave"),
            )
            .map((employee) => employee.id),
        ),
        organizationRevision: null,
      }
    } catch (cause) {
      return new UnexpectedError("legacy 組織投影を読み出せません", { cause })
    }
  }

  const states = await new EmployeeLifecycleReadRepository(props.c).findStatesAt(
    props.employeeRows.map((employee) => employee.id),
    props.snapshot.asOf,
  )
  if (states instanceof ApplicationError) return states

  try {
    const activeDepartmentRows = await props.c.var.database
      .select({ code: orgDepartments.code })
      .from(orgDepartments)
      .where(isNull(orgDepartments.archivedAt))
    const activeDepartments = new Set(activeDepartmentRows.map((department) => department.code))
    const activeStates = [...states.values()].filter(
      (state) => !state.archived && (state.status === "active" || state.status === "leave"),
    )
    const activeCodes = new Set(activeStates.map((state) => state.employeeCode))
    if (
      props.snapshot.organizationRevision === null ||
      [...states.values()].some(
        (state) => state.organizationRevision !== props.snapshot.organizationRevision,
      )
    ) {
      return revisionConflict()
    }

    return {
      memberships: activeStates.flatMap((state) =>
        [
          ...(state.primaryAssignment === null ? [] : [state.primaryAssignment]),
          ...state.concurrentAssignments,
        ]
          .filter((assignment) => activeDepartments.has(assignment.departmentCode))
          .map((assignment) => ({
            employeeCode: state.employeeCode,
            departmentCode: assignment.departmentCode,
            managerEmployeeCode:
              assignment.managerEmployeeCode !== null &&
              activeCodes.has(assignment.managerEmployeeCode)
                ? assignment.managerEmployeeCode
                : null,
            evidence: {
              type: "lifecycle_assignment",
              assignment_period_id: assignment.periodId,
              department_code: assignment.departmentCode,
              employee_code: state.employeeCode,
              employee_revision: state.employeeRevision,
              manager_employee_code: assignment.managerEmployeeCode,
              organization_revision: state.organizationRevision,
              as_of: props.snapshot.asOf,
            },
          })),
      ),
      departments: activeStates.flatMap((state) =>
        state.responsibilityDepartmentCodes
          .filter((code) => activeDepartments.has(code))
          .map((code) => ({
            code,
            managerEmployeeCode: state.employeeCode,
            evidence: {
              type: "lifecycle_responsibility",
              department_code: code,
              manager_employee_code: state.employeeCode,
              employee_revision: state.employeeRevision,
              organization_revision: state.organizationRevision,
              as_of: props.snapshot.asOf,
            },
          })),
      ),
      liveEmployeeIds: new Set(activeStates.map((state) => state.employeeId)),
      organizationRevision: props.snapshot.organizationRevision,
    }
  } catch (cause) {
    return new UnexpectedError("ライフサイクル組織投影を読み出せません", { cause })
  }
}

/**
 * 指定時点の Company 組織・責任・Account 対応から判断候補と証拠 snapshot を解決する。
 * request、System、業務 App の語彙は解釈しない。評価不能、循環、revision 不整合は fail closed。
 */
export async function resolveOrganizationalAuthorityCandidates(props: {
  c: Context
  subjectEmployeeId: number | null
  criteria: ReadonlyArray<OrganizationalAuthorityCriterion>
  resolvedAt: string
  targetDepartmentCode?: string | null
}): Promise<OrganizationalAuthorityCandidateResolution | ApplicationError> {
  const snapshot = await resolveSnapshot(props.c, props.resolvedAt)
  if (snapshot instanceof ApplicationError) return snapshot

  try {
    const employeeRows = await props.c.var.database
      .select({
        id: employees.id,
        code: employees.code,
        status: employees.status,
        archivedAt: employees.archivedAt,
      })
      .from(employees)

    if (snapshot.source === "lifecycle") {
      const canonicalResolution = await resolveCanonicalOrganizationAuthority({
        c: props.c,
        subjectEmployeeId: props.subjectEmployeeId,
        criteria: props.criteria,
        employeeRows,
        targetDepartmentCode: props.targetDepartmentCode ?? null,
        asOf: snapshot.asOf,
      })
      if (canonicalResolution instanceof ApplicationError) return canonicalResolution
      if (canonicalResolution.snapshot.organizationRevision === null) {
        return new UnexpectedError("正規組織 snapshot に revision がありません")
      }

      const finalOrganizationRevision = await readOrganizationRevision(props.c)
      if (finalOrganizationRevision instanceof ApplicationError) return finalOrganizationRevision
      if (finalOrganizationRevision !== canonicalResolution.snapshot.organizationRevision) {
        return revisionConflict()
      }

      return {
        snapshot: canonicalResolution.snapshot,
        candidates: canonicalResolution.candidates,
      }
    }

    const organization = await loadOrganizationProjection({
      c: props.c,
      employeeRows,
      snapshot,
    })
    if (organization instanceof ApplicationError) return organization

    const accountRows = await props.c.var.database
      .select({
        legacyId: accounts.id,
        systemId: systemAccounts.id,
        employeeId: accountEmployeeLinks.employeeId,
      })
      .from(accounts)
      .innerJoin(accountEmployeeLinks, eq(accountEmployeeLinks.accountId, accounts.id))
      .innerJoin(systemAccounts, sql`${systemAccounts.id} = CAST(${accounts.id} AS TEXT)`)
      .where(and(eq(accounts.status, "active"), eq(systemAccounts.status, "active")))
    const resolvedSnapshot: OrganizationalAuthoritySnapshot = {
      ...snapshot,
      organizationRevision: organization.organizationRevision,
    }

    if (resolvedSnapshot.organizationRevision !== null) {
      const finalOrganizationRevision = await readOrganizationRevision(props.c)
      if (finalOrganizationRevision instanceof ApplicationError) return finalOrganizationRevision
      if (finalOrganizationRevision !== resolvedSnapshot.organizationRevision) {
        return revisionConflict()
      }
    }

    const workforceResolution = resolveWorkforceOrganizationalAuthority({
      snapshot: resolvedSnapshot,
      criteria: props.criteria,
      employeeRows,
      organization,
      accountRows,
      subjectEmployeeId: props.subjectEmployeeId,
      targetDepartmentCode: props.targetDepartmentCode ?? null,
    })
    if (workforceResolution instanceof OrganizationalAuthorityError) {
      return workforceResolution.code === "organizational_authority_manager_cycle"
        ? new ConflictError("上司関係が循環しているため判断資格を固定できません", "manager_cycle")
        : new ConflictError(
            "組織投影が不整合なため判断資格を固定できません",
            workforceResolution.code,
          )
    }
    if (workforceResolution instanceof Error) {
      return new UnexpectedError("共通の組織資格を解決できません", {
        cause: workforceResolution,
      })
    }

    return {
      snapshot: resolvedSnapshot,
      candidates: workforceResolution.candidates,
    }
  } catch (cause) {
    return new UnexpectedError("組織上の判断資格を解決できません", { cause })
  }
}
