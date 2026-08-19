import type {
  AccountEmployeeLinkQuery,
  AccountEmployeeLinkReadPort,
  AccountEmployeeLinkReadPortResult,
} from "@/contexts/company/application/workforce/resolve-account-employee-link"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/employee-lifecycle/to-workforce-lifecycle-schedules"
import { restoreWorkforceId } from "@/contexts/company/domain/workforce/restore-workforce-id"
import type { Context } from "@/env"

type LinkRow = Readonly<{
  account_id: string
  employee_id: number
  account_status: string | null
}>

function storageEmployeeId(employeeId: string): number | null {
  const match = /^employee:(0|[1-9]\d*)$/.exec(employeeId)
  if (match === null) return null

  const value = Number(match[1])
  if (!Number.isSafeInteger(value) || value < 1) return null
  return toWorkforceEmployeeId(value) === employeeId ? value : null
}

/** Company link tableとcanonical System Accountを共通Application portへ接続する。 */
export class AccountEmployeeLinkReadRepository implements AccountEmployeeLinkReadPort {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async find(query: AccountEmployeeLinkQuery): Promise<AccountEmployeeLinkReadPortResult> {
    const employeeId =
      query.kind === "by_employee" ? storageEmployeeId(String(query.employeeId)) : null
    if (query.kind === "by_employee" && employeeId === null) {
      return { ok: true, records: [] }
    }

    try {
      const statement = this.c.env.DB.prepare(
        `SELECT
           link.account_id,
           link.employee_id AS employee_id,
           account.status AS account_status
         FROM account_employee_links link
         LEFT JOIN system_accounts account
           ON account.id = link.account_id
         WHERE ${query.kind === "by_account" ? "link.account_id = ?1" : "link.employee_id = ?1"}`,
      ).bind(query.kind === "by_account" ? query.accountId : employeeId)
      const rows = await statement.all<LinkRow>()

      return {
        ok: true,
        records: rows.results.map((row) => ({
          link: {
            accountId: restoreWorkforceId("system_account", row.account_id),
            employeeId: toWorkforceEmployeeId(row.employee_id),
          },
          accountEligible: row.account_status === "active",
        })),
      }
    } catch (cause) {
      return { ok: false, cause }
    }
  }
}
