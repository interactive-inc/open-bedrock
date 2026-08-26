import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import type { WorkforceStateAt } from "@/contexts/company/domain/policies/resolve-workforce-state.policy"
import type {
  EmployeeId,
  OrganizationUnitId,
} from "@/contexts/company/domain/definitions/workforce-id.definition"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import { OrganizationUnitReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-unit-read.adapter"
import { OrganizationWorkforceSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-workforce-snapshot.adapter"
import { ReadOrganizationWorkforceState } from "@/contexts/company/lib/workforce/read-organization-workforce-state"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { CompanyUnavailableError } from "@/contexts/company/domain/errors"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { asc } from "drizzle-orm"

export type CurrentOrganizationAssignment = {
  departmentCode: string
  position: string | null
  managerEmployeeCode: string | null
  assignmentType: "primary" | "concurrent"
}

export type CurrentOrganizationEmployee = {
  id: EmployeeId
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
  id: EmployeeId
  employeeCode: string | null
  officialName: string
}>

function activeStatus(state: WorkforceStateAt): "active" | "leave" | null {
  if (state.status === "ACTIVE") return "active"
  if (state.status === "ON_LEAVE") return "leave"
  return null
}

/** 現在有効なCompany Organization投影を読み込む。 */
async function loadCurrentOrganization(
  c: CompanyContext,
): Promise<CurrentOrganizationReadModel | Error> {
  try {
    const businessDate = resolveCompanyBusinessDate({
      now: c.env.NOW ?? new Date().toISOString(),
      timeZone: c.env.COMPANY_TIME_ZONE,
    })
    if (typeof businessDate !== "string") return businessDate

    const [employeeRows, snapshot] = await Promise.all([
      c.var.database
        .select({
          id: employees.id,
          employeeCode: employees.employeeCode,
          officialName: employees.officialName,
        })
        .from(employees)
        .orderBy(asc(employees.id)),
      new ReadOrganizationWorkforceState({
        organization: new OrganizationUnitReadAdapter(c.var.database),
        workforce: new OrganizationWorkforceSnapshotAdapter(c),
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
      employeeRows.map((employee) => [employee.id, employee]),
    )
    const unitById = new Map(
      snapshot.organization.units.map((unit) => [unit.organizationUnitId, unit]),
    )
    const organizationUnits = snapshot.organization.units.filter((unit) => unit.kind !== "COMPANY")
    const organizationCodes = new Set(organizationUnits.map((unit) => unit.code))
    const codeByUnitId = new Map<OrganizationUnitId, string>()
    for (const unit of organizationUnits) {
      codeByUnitId.set(unit.organizationUnitId, unit.code)
    }

    const currentDepartments = organizationUnits.map((unit, order) => {
      const parent =
        unit.parentOrganizationUnitId === null
          ? undefined
          : unitById.get(unit.parentOrganizationUnitId)

      return {
        code: unit.code,
        name: unit.officialName,
        parentCode:
          parent === undefined || !organizationCodes.has(parent.code) ? null : parent.code,
        order,
      }
    })

    const employeesByCode = new Map<string, CurrentOrganizationEmployee>()
    const managersByDepartment = new Map<string, string[]>()
    for (const state of snapshot.employees) {
      const employee = employeeById.get(state.employeeId)
      const status = activeStatus(state)
      if (employee === undefined || employee.employeeCode === null || status === null) {
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
                : (employeeById.get(assignment.managerEmployeeId)?.employeeCode ?? null),
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
      employeesByCode.set(employee.employeeCode, {
        id: employee.id,
        code: employee.employeeCode,
        name: employee.officialName,
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
          employee.employeeCode,
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
type Context = CompanyContext

export class CurrentOrganizationReadModelAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async loadCurrentOrganization(): Promise<CurrentOrganizationReadModel | Error> {
    return loadCurrentOrganization(this.c)
  }
}
