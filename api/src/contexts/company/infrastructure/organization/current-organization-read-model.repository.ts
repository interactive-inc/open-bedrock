import { toWorkforceEmployeeId } from "@/contexts/company/domain/policies/to-workforce-lifecycle-schedules.policy"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import type { WorkforceStateAt } from "@/contexts/company/domain/policies/resolve-workforce-state.policy"
import type {
  EmployeeId,
  OrganizationUnitId,
} from "@/contexts/company/domain/definitions/workforce-id.definition"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import { departments, orgDepartments } from "@/contexts/company/infrastructure/schema/organization"
import { OrganizationUnitReadRepository } from "@/contexts/company/infrastructure/workforce/organization-unit-read.repository"
import { OrganizationWorkforceSnapshotRepository } from "@/contexts/company/infrastructure/workforce/organization-workforce-snapshot.repository"
import { ReadOrganizationWorkforceState } from "@/contexts/company/infrastructure/workforce/read-organization-workforce-state.repository"
import type { CompanyContext } from "@/contexts/company/infrastructure/configuration/company-context.repository"
import { CompanyUnavailableError } from "@/contexts/company/domain/errors"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { asc, eq, isNull } from "drizzle-orm"

export type CurrentOrganizationAssignment = {
  departmentCode: string
  position: string | null
  managerEmployeeCode: string | null
  assignmentType: "primary" | "concurrent"
}

export type CurrentOrganizationEmployee = {
  id: number
  code: string
  name: string
  status: "active" | "leave"
  position: string | null
  primaryDepartmentCode: string | null
  managerEmployeeCode: string | null
  departmentCodes: ReadonlyArray<string>
  assignments: ReadonlyArray<CurrentOrganizationAssignment>
}

export type CurrentOrganizationDepartment = {
  code: string
  departmentId: number
  name: string
  parentCode: string | null
  order: number
}

export type CurrentOrganizationReadModel = {
  source: "lifecycle"
  asOf: string | null
  departments: ReadonlyArray<CurrentOrganizationDepartment>
  employeesByCode: ReadonlyMap<string, CurrentOrganizationEmployee>
  managerByDepartmentCode: ReadonlyMap<string, string>
}

type EmployeeDirectoryRow = Readonly<{
  id: number
  code: string | null
  name: string
  archivedAt: number | null
}>

function activeStatus(state: WorkforceStateAt): "active" | "leave" | null {
  if (state.status === "ACTIVE") return "active"
  if (state.status === "ON_LEAVE") return "leave"
  return null
}

/** 現在有効なCompany Organization投影を読み込む。 */
export async function loadCurrentOrganization(
  c: CompanyContext,
): Promise<CurrentOrganizationReadModel | Error> {
  try {
    const businessDate = resolveCompanyBusinessDate({
      now: c.env.NOW ?? new Date().toISOString(),
      timeZone: c.env.COMPANY_TIME_ZONE,
    })
    if (typeof businessDate !== "string") return businessDate

    const [directoryDepartments, employeeRows, snapshot] = await Promise.all([
      c.var.database
        .select({
          code: orgDepartments.code,
          departmentId: orgDepartments.departmentId,
          name: departments.name,
          order: orgDepartments.sortOrder,
        })
        .from(orgDepartments)
        .innerJoin(departments, eq(departments.id, orgDepartments.departmentId))
        .where(isNull(orgDepartments.archivedAt))
        .orderBy(asc(orgDepartments.sortOrder), asc(orgDepartments.code)),
      c.var.database
        .select({
          id: employees.id,
          code: employees.code,
          name: employees.name,
          archivedAt: employees.archivedAt,
        })
        .from(employees)
        .orderBy(asc(employees.id)),
      new ReadOrganizationWorkforceState({
        organization: new OrganizationUnitReadRepository(c.var.database),
        workforce: new OrganizationWorkforceSnapshotRepository(c),
      }).execute(restoreCalendarDate(businessDate)),
    ])
    if (snapshot.kind !== "found") {
      return new CompanyUnavailableError(
        "Company organization snapshotを安全に解決できません",
        snapshot.kind === "invalid"
          ? "company_organization_invalid"
          : "company_organization_unavailable",
        snapshot.kind === "unavailable" ? { cause: snapshot.cause } : undefined,
      )
    }

    const employeeById = new Map<EmployeeId, EmployeeDirectoryRow>(
      employeeRows.map((employee) => [toWorkforceEmployeeId(employee.id), employee]),
    )
    const directoryByCode = new Map(
      directoryDepartments.map((department) => [department.code, department]),
    )
    const unitById = new Map(
      snapshot.organization.units.map((unit) => [unit.organizationUnitId, unit]),
    )
    const codeByUnitId = new Map<OrganizationUnitId, string>()
    for (const unit of snapshot.organization.units) {
      if (directoryByCode.has(unit.code)) codeByUnitId.set(unit.organizationUnitId, unit.code)
    }

    const currentDepartments = directoryDepartments.flatMap((directory) => {
      const unit = snapshot.organization.units.find(
        (candidate) => candidate.code === directory.code,
      )
      if (unit === undefined) return []
      const parent =
        unit.parentOrganizationUnitId === null
          ? undefined
          : unitById.get(unit.parentOrganizationUnitId)

      return [
        {
          code: directory.code,
          departmentId: directory.departmentId,
          name: directory.name,
          parentCode:
            parent === undefined || !directoryByCode.has(parent.code) ? null : parent.code,
          order: directory.order,
        },
      ]
    })

    const employeesByCode = new Map<string, CurrentOrganizationEmployee>()
    const managersByDepartment = new Map<string, string[]>()
    for (const state of snapshot.employees) {
      const employee = employeeById.get(state.employeeId)
      const status = activeStatus(state)
      if (
        employee === undefined ||
        employee.code === null ||
        employee.archivedAt !== null ||
        status === null
      ) {
        continue
      }
      const assignments = [
        ...(state.primaryAssignment === null ? [] : [state.primaryAssignment]),
        ...state.concurrentAssignments,
      ].flatMap((assignment) => {
        const departmentCode = codeByUnitId.get(assignment.organizationUnitId)
        if (departmentCode === undefined) return []

        return [
          {
            departmentCode,
            position: assignment.positionTitle,
            managerEmployeeCode:
              assignment.managerEmployeeId === null
                ? null
                : (employeeById.get(assignment.managerEmployeeId)?.code ?? null),
            assignmentType:
              assignment.assignmentType === "PRIMARY"
                ? ("primary" as const)
                : ("concurrent" as const),
          },
        ]
      })
      const managerDepartmentCodes = state.responsibilities.flatMap((responsibility) => {
        if (responsibility.responsibilityType !== "MANAGER") return []
        const departmentCode = codeByUnitId.get(responsibility.organizationUnitId)

        return departmentCode === undefined ? [] : [departmentCode]
      })
      if (assignments.length === 0 && managerDepartmentCodes.length === 0) continue
      const primary = assignments.find((assignment) => assignment.assignmentType === "primary")
      employeesByCode.set(employee.code, {
        id: employee.id,
        code: employee.code,
        name: employee.name,
        status,
        position: primary?.position ?? null,
        primaryDepartmentCode: primary?.departmentCode ?? null,
        managerEmployeeCode: primary?.managerEmployeeCode ?? null,
        departmentCodes: [...new Set(assignments.map((assignment) => assignment.departmentCode))],
        assignments,
      })

      for (const departmentCode of managerDepartmentCodes) {
        managersByDepartment.set(departmentCode, [
          ...(managersByDepartment.get(departmentCode) ?? []),
          employee.code,
        ])
      }
    }

    return {
      source: "lifecycle",
      asOf: businessDate,
      departments: currentDepartments,
      employeesByCode,
      managerByDepartmentCode: new Map(
        [...managersByDepartment].flatMap(([code, managers]) =>
          managers.length === 1 ? [[code, managers[0]!] as const] : [],
        ),
      ),
    }
  } catch (error) {
    return error instanceof Error ? error : new Error("failed to load current organization")
  }
}
