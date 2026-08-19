import type { AccountId } from "@system/domain/auth/account-id"
import type { Context } from "@/env"

export type CompanyAccountParticipant = Readonly<{
  accountId: AccountId
  employeeId: number
  employeeCode: string | null
  employeeName: string
  departmentName: string | null
  status: string
  archivedAt: number | null
}>

/** canonical Account IDをCompanyの表示・在籍主体へ一意に解決する。 */
export async function resolveCompanyAccountParticipants(
  c: Context,
  accountIds: ReadonlyArray<AccountId>,
): Promise<ReadonlyArray<CompanyAccountParticipant> | Error> {
  if (accountIds.length === 0) return []
  try {
    const unique = [...new Set(accountIds)]
    const placeholders = unique.map((_, index) => `?${index + 1}`).join(", ")
    const rows = await c.env.DB.prepare(
      `SELECT link.account_id,
              employee.id AS employee_id,
              employee.code AS employee_code,
              employee.name AS employee_name,
              employee.dept_name AS department_name,
              employee.status,
              employee.archived_at
       FROM account_employee_links AS link
       JOIN employees AS employee ON employee.id = link.employee_id
       WHERE link.account_id IN (${placeholders})
       ORDER BY account_id`,
    )
      .bind(...unique)
      .all<{
        account_id: AccountId
        employee_id: number
        employee_code: string | null
        employee_name: string
        department_name: string | null
        status: string
        archived_at: number | null
      }>()

    return rows.results.map((row) => ({
      accountId: row.account_id,
      employeeId: row.employee_id,
      employeeCode: row.employee_code,
      employeeName: row.employee_name,
      departmentName: row.department_name,
      status: row.status,
      archivedAt: row.archived_at,
    }))
  } catch (cause) {
    return cause instanceof Error
      ? cause
      : new Error("failed to resolve Company Account participants", { cause })
  }
}
