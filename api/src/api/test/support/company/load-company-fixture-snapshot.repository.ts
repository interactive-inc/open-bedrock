import type { Context } from "@/env"
import { ApplicationError, UnexpectedError } from "@/lib/errors"
import { lifecycleSha256 } from "@/contexts/company/domain/definitions/lifecycle-sha256.definition"
import { stableLifecycleJson } from "@/contexts/company/domain/definitions/stable-lifecycle-json.definition"

export type CompanyFixtureEmployee = {
  id: number
  code: string
  name: string
  deptId: number | null
  deptName: string | null
  position: string | null
  status: "active" | "leave" | "retired"
}

export type CompanyFixtureDepartment = {
  code: string
  departmentId: number
  name: string
  managerEmployeeCode: string | null
}

export type CompanyFixtureMembership = {
  departmentCode: string
  employeeCode: string
  managerEmployeeCode: string | null
}

export type CompanyFixtureIssue = {
  code:
    | "ambiguous_department_mapping"
    | "missing_department_mapping"
    | "broken_employee_reference"
    | "broken_manager_reference"
    | "broken_department_reference"
  employeeCode: string | null
  departmentCode: string | null
}

export type CompanyFixtureSnapshot = {
  employees: ReadonlyArray<CompanyFixtureEmployee>
  departments: ReadonlyArray<CompanyFixtureDepartment>
  memberships: ReadonlyArray<CompanyFixtureMembership>
  issues: ReadonlyArray<CompanyFixtureIssue>
  fingerprint: string
}

/**
 * 製品fixture（employees / org_departments / org_memberships）を読み出し、
 * 参照不整合や部署マッピングの問題を収集して決定的なsnapshotを返す。
 */
export async function loadCompanyFixtureSnapshot(
  c: Context,
): Promise<CompanyFixtureSnapshot | ApplicationError> {
  try {
    const [employeeRows, departmentRows, membershipRows] = await Promise.all([
      c.env.DB.prepare(
        `SELECT id, code, name, dept_id, dept_name, position, status
           FROM employees ORDER BY id`,
      ).all<{
        id: number
        code: string
        name: string
        dept_id: number | null
        dept_name: string | null
        position: string | null
        status: "active" | "leave" | "retired"
      }>(),
      c.env.DB.prepare(
        `SELECT organization.code, organization.department_id, department.name,
                  organization.manager_employee_code
           FROM org_departments AS organization
           INNER JOIN departments AS department ON department.id = organization.department_id
           ORDER BY organization.code`,
      ).all<{
        code: string
        department_id: number
        name: string
        manager_employee_code: string | null
      }>(),
      c.env.DB.prepare(
        `SELECT department_code, employee_code, manager_employee_code
           FROM org_memberships ORDER BY department_code, employee_code`,
      ).all<{
        department_code: string
        employee_code: string
        manager_employee_code: string | null
      }>(),
    ])
    const employees = employeeRows.results.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      deptId: row.dept_id,
      deptName: row.dept_name,
      position: row.position,
      status: row.status,
    }))
    const departments = departmentRows.results.map((row) => ({
      code: row.code,
      departmentId: row.department_id,
      name: row.name,
      managerEmployeeCode: row.manager_employee_code,
    }))
    const memberships = membershipRows.results.map((row) => ({
      departmentCode: row.department_code,
      employeeCode: row.employee_code,
      managerEmployeeCode: row.manager_employee_code,
    }))
    const employeeCodes = new Set(employees.map((employee) => employee.code))
    const departmentCodes = new Set(departments.map((department) => department.code))
    const issues: CompanyFixtureIssue[] = []
    const departmentsById = new Map<number, Array<CompanyFixtureDepartment>>()
    for (const department of departments) {
      const candidates = departmentsById.get(department.departmentId) ?? []
      candidates.push(department)
      departmentsById.set(department.departmentId, candidates)
    }

    for (const [departmentId, candidates] of departmentsById) {
      if (candidates.length > 1) {
        issues.push({
          code: "ambiguous_department_mapping",
          employeeCode:
            employees.find((employee) => employee.deptId === departmentId)?.code ?? null,
          departmentCode: null,
        })
      }
    }

    for (const employee of employees) {
      if (employee.deptId !== null && !departmentsById.has(employee.deptId)) {
        issues.push({
          code: "missing_department_mapping",
          employeeCode: employee.code,
          departmentCode: null,
        })
      }
    }

    for (const membership of memberships) {
      if (!employeeCodes.has(membership.employeeCode)) {
        issues.push({
          code: "broken_employee_reference",
          employeeCode: membership.employeeCode,
          departmentCode: membership.departmentCode,
        })
      }
      if (!departmentCodes.has(membership.departmentCode)) {
        issues.push({
          code: "broken_department_reference",
          employeeCode: membership.employeeCode,
          departmentCode: membership.departmentCode,
        })
      }
      if (
        membership.managerEmployeeCode !== null &&
        !employeeCodes.has(membership.managerEmployeeCode)
      ) {
        issues.push({
          code: "broken_manager_reference",
          employeeCode: membership.employeeCode,
          departmentCode: membership.departmentCode,
        })
      }
    }

    for (const department of departments) {
      if (
        department.managerEmployeeCode !== null &&
        !employeeCodes.has(department.managerEmployeeCode)
      ) {
        issues.push({
          code: "broken_manager_reference",
          employeeCode: department.managerEmployeeCode,
          departmentCode: department.code,
        })
      }
    }

    const fingerprint = await lifecycleSha256(
      stableLifecycleJson({ employees, departments, memberships }),
    )
    return { employees, departments, memberships, issues, fingerprint }
  } catch (cause) {
    return new UnexpectedError("Company fixtureの検査に失敗しました", { cause })
  }
}
