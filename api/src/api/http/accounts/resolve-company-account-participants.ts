import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { Context } from "@/env"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { EmploymentStatus } from "@/contexts/company/domain/definitions/employment-status.definition"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"

export type CompanyAccountParticipant = Readonly<{
  accountId: AccountId
  employeeId: EmployeeId
  employeeCode: string | null
  employeeName: string
  departmentName: string | null
  status: EmploymentStatus
}>

/** canonical Account IDをCompanyの表示・在籍主体へ一意に解決する。 */
export async function resolveCompanyAccountParticipants(
  c: Context,
  accountIds: ReadonlyArray<AccountId>,
): Promise<ReadonlyArray<CompanyAccountParticipant> | Error> {
  if (accountIds.length === 0) return []
  const businessDate = resolveCompanyBusinessDate({
    now: c.env.NOW ?? new Date().toISOString(),
    timeZone: c.env.COMPANY_TIME_ZONE,
  })
  if (businessDate instanceof Error) return businessDate
  try {
    const unique = [...new Set(accountIds)]
    const placeholders = unique.map((_, index) => `?${index + 2}`).join(", ")
    const rows = await c.env.DB.prepare(
      `WITH current_assignment AS (
         SELECT assignment.employee_id, assignment.organization_unit_id
         FROM company_organization_assignment_period_versions AS assignment
         WHERE assignment.assignment_type = 'PRIMARY'
           AND assignment.is_void = 0
           AND assignment.starts_on <= ?1
           AND (assignment.ends_on IS NULL OR assignment.ends_on >= ?1)
           AND NOT EXISTS (
             SELECT 1 FROM company_organization_assignment_period_versions AS newer
             WHERE newer.period_id = assignment.period_id
               AND newer.revision > assignment.revision
           )
       ),
       current_unit AS (
         SELECT unit.organization_unit_id, unit.official_name
         FROM company_organization_unit_period_versions AS unit
         WHERE unit.is_void = 0
           AND unit.starts_on <= ?1
           AND (unit.ends_on IS NULL OR unit.ends_on >= ?1)
           AND NOT EXISTS (
             SELECT 1 FROM company_organization_unit_period_versions AS newer
             WHERE newer.period_id = unit.period_id
               AND newer.revision > unit.revision
           )
       )
       SELECT link.account_id,
              employee.id AS employee_id,
              employee.employee_code,
              employee.official_name AS employee_name,
              unit.official_name AS department_name,
              COALESCE(employment.status, 'TERMINATED') AS status,
              employment.id AS employment_id
       FROM company_account_employee_links AS link
       JOIN company_employees AS employee ON employee.id = link.employee_id
       LEFT JOIN company_employments AS employment
        ON employment.employee_id = employee.id
        AND employment.termination_date IS NULL
       LEFT JOIN current_assignment AS assignment ON assignment.employee_id = employee.id
       LEFT JOIN current_unit AS unit
         ON unit.organization_unit_id = assignment.organization_unit_id
       WHERE link.account_id IN (${placeholders})
       ORDER BY account_id`,
    )
      .bind(businessDate, ...unique)
      .all<{
        account_id: AccountId
        employee_id: EmployeeId
        employee_code: string | null
        employee_name: string
        department_name: string | null
        status: EmploymentStatus
        employment_id: string | null
      }>()

    return rows.results.map((row) => ({
      accountId: row.account_id,
      employeeId: row.employee_id,
      employeeCode: row.employee_code,
      employeeName: row.employee_name,
      departmentName: row.department_name,
      status: row.status,
    }))
  } catch (cause) {
    return cause instanceof Error
      ? cause
      : new Error("failed to resolve Company Account participants", { cause })
  }
}
