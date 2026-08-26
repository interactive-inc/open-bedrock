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
type Context = CompanyContext

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
             AND (assignment.ends_on IS NULL OR assignment.ends_on >= ?1)
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
             AND (unit.ends_on IS NULL OR unit.ends_on >= ?1)
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
          AND employment.termination_date IS NULL
         LEFT JOIN current_assignment AS assignment ON assignment.employee_id = employee.id
         LEFT JOIN current_unit AS unit
           ON unit.organization_unit_id = assignment.organization_unit_id
         WHERE ${predicate}
         LIMIT 1`,
      )
        .bind(businessDate, value)
        .first<EmployeeDirectoryRow>()
      if (row === null) return null
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
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to read Company employee directory")
    }
  }
}
