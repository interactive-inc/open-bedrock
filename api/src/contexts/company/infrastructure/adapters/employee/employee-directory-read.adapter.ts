import type { CompanyEmployeeDirectoryEntry } from "@/contexts/company/domain/definitions/employee-directory-entry.definition"
import type {
  EmployeeId,
  EmploymentId,
} from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"

type EmployeeDirectoryRow = Readonly<{
  id: string
  official_name: string
  employee_code: string | null
  email: string | null
  phone: string | null
  employment_id: string | null
  employment_status: "ACTIVE" | "ON_LEAVE" | "TERMINATED" | null
  organization_unit_id: string | null
  organization_unit_code: string | null
  organization_unit_name: string | null
  position_title: string | null
}>

export type CompanyEmployeeDirectoryPage = Readonly<{
  employees: ReadonlyArray<CompanyEmployeeDirectoryEntry>
  total: number
}>

type Context = Readonly<{ env: CompanyContext["env"] }>

/** canonical Company tableだけからEmployee directoryを読む。 */
export class CompanyEmployeeDirectoryReadAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  findById(employeeId: EmployeeId): Promise<CompanyEmployeeDirectoryEntry | null | Error> {
    return this.find("employee.id = ?2", employeeId)
  }

  findByCode(employeeCode: string): Promise<CompanyEmployeeDirectoryEntry | null | Error> {
    return this.find("employee.employee_code = ?2", employeeCode)
  }

  async list(input: {
    query: string | null
    organizationUnit: string | null
    status: "active" | "leave" | "retired" | null
    limit: number
    offset: number
  }): Promise<CompanyEmployeeDirectoryPage | Error> {
    if (
      !Number.isSafeInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > 100 ||
      !Number.isSafeInteger(input.offset) ||
      input.offset < 0 ||
      input.offset > 10_000
    ) {
      return new Error("invalid Company employee directory page")
    }
    const businessDate = resolveCompanyBusinessDate({
      now: this.c.env.NOW ?? new Date().toISOString(),
      timeZone: this.c.env.COMPANY_TIME_ZONE,
    })
    if (businessDate instanceof Error) return businessDate

    const conditions: string[] = []
    const values: unknown[] = []
    if (input.query !== null) {
      conditions.push(
        "(instr(lower(employee.official_name), lower(?)) > 0 OR instr(lower(coalesce(employee.employee_code, '')), lower(?)) > 0)",
      )
      values.push(input.query, input.query)
    }
    if (input.organizationUnit !== null) {
      conditions.push("(unit.code = ? OR unit.official_name = ?)")
      values.push(input.organizationUnit, input.organizationUnit)
    }
    if (input.status !== null) {
      conditions.push("employment.status = ?")
      values.push(
        input.status === "active" ? "ACTIVE" : input.status === "leave" ? "ON_LEAVE" : "TERMINATED",
      )
    }
    const where = conditions.length === 0 ? "" : `WHERE ${conditions.join(" AND ")}`
    const commonSql = `WITH current_employment AS (
       SELECT employment.*
       FROM company_employments AS employment
       WHERE NOT EXISTS (
           SELECT 1 FROM company_employments AS newer
           WHERE newer.employee_id = employment.employee_id
             AND (newer.hire_date > employment.hire_date
               OR (newer.hire_date = employment.hire_date AND newer.id > employment.id))
         )
     ),
     current_assignment AS (
       SELECT assignment.employee_id, assignment.organization_unit_id, assignment.position_title
       FROM company_organization_assignment_period_versions AS assignment
       WHERE assignment.assignment_type = 'PRIMARY'
         AND assignment.is_void = 0
         AND assignment.starts_on <= ?
         AND (assignment.ends_on IS NULL OR ? < assignment.ends_on)
         AND NOT EXISTS (
           SELECT 1 FROM company_organization_assignment_period_versions AS newer
           WHERE newer.period_id = assignment.period_id AND newer.revision > assignment.revision
         )
     ),
     current_unit AS (
       SELECT unit.organization_unit_id, unit.code, unit.official_name
       FROM company_organization_unit_period_versions AS unit
       WHERE unit.is_void = 0
         AND unit.starts_on <= ?
         AND (unit.ends_on IS NULL OR ? < unit.ends_on)
         AND NOT EXISTS (
           SELECT 1 FROM company_organization_unit_period_versions AS newer
           WHERE newer.period_id = unit.period_id AND newer.revision > unit.revision
         )
     )`
    const commonValues = Array(4).fill(businessDate)
    const fromSql = `FROM company_employees AS employee
       LEFT JOIN current_employment AS employment ON employment.employee_id = employee.id
       LEFT JOIN current_assignment AS assignment ON assignment.employee_id = employee.id
       LEFT JOIN current_unit AS unit ON unit.organization_unit_id = assignment.organization_unit_id
       ${where}`

    try {
      const [rows, total] = await Promise.all([
        this.c.env.DB.prepare(
          `${commonSql}
           SELECT employee.id, employee.official_name, employee.employee_code,
                  employee.email, employee.phone,
                  employment.id AS employment_id, employment.status AS employment_status,
                  assignment.organization_unit_id,
                  unit.code AS organization_unit_code,
                  unit.official_name AS organization_unit_name,
                  assignment.position_title
           ${fromSql}
           ORDER BY employee.employee_code, employee.id
           LIMIT ? OFFSET ?`,
        )
          .bind(...commonValues, ...values, input.limit, input.offset)
          .all<EmployeeDirectoryRow>(),
        this.c.env.DB.prepare(`${commonSql} SELECT count(*) AS total ${fromSql}`)
          .bind(...commonValues, ...values)
          .first<number>("total"),
      ])
      const employees: CompanyEmployeeDirectoryEntry[] = []
      for (const row of rows.results) {
        const restored = restoreEmployeeDirectoryEntry(row)
        if (restored instanceof Error) return restored
        employees.push(restored)
      }
      return { employees, total: total ?? 0 }
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to list Company employee directory")
    }
  }

  private async find(
    predicate: string,
    value: EmployeeId | string,
  ): Promise<CompanyEmployeeDirectoryEntry | null | Error> {
    const businessDate = resolveCompanyBusinessDate({
      now: this.c.env.NOW ?? new Date().toISOString(),
      timeZone: this.c.env.COMPANY_TIME_ZONE,
    })
    if (businessDate instanceof Error) return businessDate

    try {
      const row = await this.c.env.DB.prepare(
        `WITH current_assignment AS (
           SELECT assignment.employee_id,
                  assignment.organization_unit_id,
                  assignment.position_title
           FROM company_organization_assignment_period_versions AS assignment
           WHERE assignment.assignment_type = 'PRIMARY'
             AND assignment.is_void = 0
             AND assignment.starts_on <= ?1
             AND (assignment.ends_on IS NULL OR ?1 < assignment.ends_on)
             AND NOT EXISTS (
               SELECT 1
               FROM company_organization_assignment_period_versions AS newer
               WHERE newer.period_id = assignment.period_id
                 AND newer.revision > assignment.revision
             )
         ),
         current_unit AS (
           SELECT unit.organization_unit_id, unit.code, unit.official_name
           FROM company_organization_unit_period_versions AS unit
           WHERE unit.is_void = 0
             AND unit.starts_on <= ?1
             AND (unit.ends_on IS NULL OR ?1 < unit.ends_on)
             AND NOT EXISTS (
               SELECT 1
               FROM company_organization_unit_period_versions AS newer
               WHERE newer.period_id = unit.period_id
                 AND newer.revision > unit.revision
             )
         )
         SELECT employee.id, employee.official_name, employee.employee_code,
                employee.email, employee.phone,
                employment.id AS employment_id, employment.status AS employment_status,
                assignment.organization_unit_id,
                unit.code AS organization_unit_code,
                unit.official_name AS organization_unit_name,
                assignment.position_title
         FROM company_employees AS employee
         LEFT JOIN company_employments AS employment
           ON employment.employee_id = employee.id
          AND NOT EXISTS (
            SELECT 1 FROM company_employments AS newer
            WHERE newer.employee_id = employment.employee_id
              AND (newer.hire_date > employment.hire_date
                OR (newer.hire_date = employment.hire_date AND newer.id > employment.id))
          )
         LEFT JOIN current_assignment AS assignment ON assignment.employee_id = employee.id
         LEFT JOIN current_unit AS unit
           ON unit.organization_unit_id = assignment.organization_unit_id
         WHERE ${predicate}
         LIMIT 1`,
      )
        .bind(businessDate, value)
        .first<EmployeeDirectoryRow>()
      if (row === null) return null
      return restoreEmployeeDirectoryEntry(row)
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to read Company employee directory")
    }
  }
}

function restoreEmployeeDirectoryEntry(
  row: EmployeeDirectoryRow,
): CompanyEmployeeDirectoryEntry | Error {
  if (
    (row.employment_id === null) !== (row.employment_status === null) ||
    (row.organization_unit_id === null) !== (row.organization_unit_code === null) ||
    (row.organization_unit_id === null) !== (row.organization_unit_name === null)
  ) {
    return new Error("Company employee directory contains an incomplete canonical projection")
  }

  return Object.freeze({
    id: restoreWorkforceId("employee", row.id),
    officialName: row.official_name,
    employeeCode: row.employee_code,
    email: row.email,
    phone: row.phone,
    employment:
      row.employment_id === null || row.employment_status === null
        ? null
        : Object.freeze({
            id: restoreWorkforceId("employment", row.employment_id) as EmploymentId,
            status: row.employment_status,
          }),
    primaryAssignment:
      row.organization_unit_id === null ||
      row.organization_unit_code === null ||
      row.organization_unit_name === null
        ? null
        : Object.freeze({
            organizationUnitId: row.organization_unit_id,
            organizationUnitCode: row.organization_unit_code,
            organizationUnitName: row.organization_unit_name,
            positionTitle: row.position_title,
          }),
  })
}
