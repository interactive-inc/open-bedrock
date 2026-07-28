import type { Context } from "@/env"
import { EmployeeLifecycleReadRepository } from "@/infrastructure/employee-lifecycle/employee-lifecycle-read-repository"
import { EmployeeLifecycleRepository } from "@/infrastructure/employee-lifecycle/employee-lifecycle-repository"
import { ApplicationError } from "@/lib/errors"
import { resolveCompanyBusinessDate } from "@/lib/time/resolve-company-business-date"
import { departments, employees, orgDepartments, orgMemberships } from "@/schema"
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
  source: "lifecycle" | "legacy"
  asOf: string | null
  departments: ReadonlyArray<CurrentOrganizationDepartment>
  employeesByCode: ReadonlyMap<string, CurrentOrganizationEmployee>
  managerByDepartmentCode: ReadonlyMap<string, string>
}

export async function loadCurrentOrganization(
  c: Context,
): Promise<CurrentOrganizationReadModel | Error> {
  try {
    const [departmentRows, employeeRows, migrationStatus] = await Promise.all([
      c.var.database
        .select({
          code: orgDepartments.code,
          departmentId: orgDepartments.departmentId,
          name: departments.name,
          parentCode: orgDepartments.parentCode,
          order: orgDepartments.sortOrder,
          legacyManagerEmployeeCode: orgDepartments.managerEmployeeCode,
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
          status: employees.status,
          position: employees.position,
          archivedAt: employees.archivedAt,
        })
        .from(employees)
        .orderBy(asc(employees.code)),
      new EmployeeLifecycleRepository(c).migrationStatus(),
    ])
    if (migrationStatus instanceof ApplicationError) return migrationStatus

    const currentDepartments = departmentRows.map((department) => ({
      code: department.code,
      departmentId: department.departmentId,
      name: department.name,
      parentCode: department.parentCode,
      order: department.order,
    }))
    const departmentCodes = new Set(currentDepartments.map((department) => department.code))

    if (migrationStatus !== "verified") {
      const memberships = await c.var.database
        .select()
        .from(orgMemberships)
        .orderBy(asc(orgMemberships.departmentCode), asc(orgMemberships.employeeCode))
      const membershipsByEmployee = new Map<string, Array<(typeof memberships)[number]>>()
      for (const membership of memberships) {
        if (!departmentCodes.has(membership.departmentCode)) continue
        const current = membershipsByEmployee.get(membership.employeeCode) ?? []
        current.push(membership)
        membershipsByEmployee.set(membership.employeeCode, current)
      }
      const employeesByCode = new Map<string, CurrentOrganizationEmployee>()
      for (const employee of employeeRows) {
        if (employee.archivedAt !== null || employee.status === "retired") continue
        // code=null（外部プロビジョニング）の従業員は組織メンバーシップを持たず、組織図に載らない。
        if (employee.code === null) continue
        const employeeMemberships = membershipsByEmployee.get(employee.code) ?? []
        if (employeeMemberships.length === 0) continue
        const primary = employeeMemberships.at(0)
        employeesByCode.set(employee.code, {
          id: employee.id,
          code: employee.code,
          name: employee.name,
          status: employee.status,
          position: employee.position,
          primaryDepartmentCode: primary?.departmentCode ?? null,
          managerEmployeeCode: primary?.managerEmployeeCode ?? null,
          departmentCodes: employeeMemberships.map((membership) => membership.departmentCode),
          assignments: employeeMemberships.map((membership, index) => ({
            departmentCode: membership.departmentCode,
            position: employee.position,
            managerEmployeeCode: membership.managerEmployeeCode,
            assignmentType: index === 0 ? "primary" : "concurrent",
          })),
        })
      }
      return {
        source: "legacy",
        asOf: null,
        departments: currentDepartments,
        employeesByCode,
        managerByDepartmentCode: new Map(
          departmentRows.flatMap((department) =>
            department.legacyManagerEmployeeCode === null
              ? []
              : [[department.code, department.legacyManagerEmployeeCode] as const],
          ),
        ),
      }
    }

    const businessDate = resolveCompanyBusinessDate({
      now: c.env.NOW ?? new Date().toISOString(),
      timeZone: c.env.COMPANY_TIME_ZONE,
    })
    if (typeof businessDate !== "string") return businessDate
    const states = await new EmployeeLifecycleReadRepository(c).findStatesAt(
      employeeRows.map((employee) => employee.id),
      businessDate,
    )
    if (states instanceof ApplicationError) return states

    const employeesByCode = new Map<string, CurrentOrganizationEmployee>()
    const managerByDepartmentCode = new Map<string, string>()
    for (const employee of employeeRows) {
      // code=null（外部プロビジョニング）の従業員は組織図に載らない。
      if (employee.code === null) continue
      const state = states.get(employee.id)
      if (
        state === undefined ||
        state.archived ||
        (state.status !== "active" && state.status !== "leave")
      ) {
        continue
      }
      const assignments = [
        ...(state.primaryAssignment === null ? [] : [state.primaryAssignment]),
        ...state.concurrentAssignments,
      ]
        .filter((assignment) => departmentCodes.has(assignment.departmentCode))
        .map((assignment) => ({
          departmentCode: assignment.departmentCode,
          position: assignment.positionTitle,
          managerEmployeeCode: assignment.managerEmployeeCode,
          assignmentType: assignment.assignmentType,
        }))
      const responsibilities = state.responsibilityDepartmentCodes.filter((code) =>
        departmentCodes.has(code),
      )
      if (assignments.length === 0 && responsibilities.length === 0) continue
      const primary = assignments.find((assignment) => assignment.assignmentType === "primary")
      employeesByCode.set(employee.code, {
        id: employee.id,
        code: employee.code,
        name: employee.name,
        status: state.status,
        position: primary?.position ?? null,
        primaryDepartmentCode: primary?.departmentCode ?? null,
        managerEmployeeCode: primary?.managerEmployeeCode ?? null,
        departmentCodes: [...new Set(assignments.map((assignment) => assignment.departmentCode))],
        assignments,
      })
      for (const code of responsibilities) {
        if (!managerByDepartmentCode.has(code)) {
          managerByDepartmentCode.set(code, employee.code)
        }
      }
    }

    return {
      source: "lifecycle",
      asOf: businessDate,
      departments: currentDepartments,
      employeesByCode,
      managerByDepartmentCode,
    }
  } catch (error) {
    return error instanceof Error ? error : new Error("failed to load current organization")
  }
}
