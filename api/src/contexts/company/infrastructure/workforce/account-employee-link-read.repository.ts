import type {
  AccountEmployeeLinkQuery,
  AccountEmployeeLinkReadPort,
  AccountEmployeeLinkReadPortResult,
} from "@/contexts/company/infrastructure/workforce/resolve-account-employee-link.repository"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/employee-lifecycle/to-workforce-lifecycle-schedules"
import { restoreWorkforceId } from "@/contexts/company/domain/workforce/restore-workforce-id"
import type { Context } from "@/env"
import { zAccountId } from "@system/domain/values/account-id.schema"
import { SystemAccountRepository } from "@system/infrastructure/auth/system-account.repository"

type LinkRow = Readonly<{
  account_id: string
  employee_id: number
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
        `SELECT account_id, employee_id
         FROM account_employee_links
         WHERE ${query.kind === "by_account" ? "account_id = ?1" : "employee_id = ?1"}`,
      ).bind(query.kind === "by_account" ? query.accountId : employeeId)
      const rows = await statement.all<LinkRow>()
      const accounts = await Promise.all(
        rows.results.map(async (row) => {
          const accountId = zAccountId.safeParse(row.account_id)
          return accountId.success
            ? new SystemAccountRepository({ database: this.c.env.DB }).findById(accountId.data)
            : null
        }),
      )
      const unavailable = accounts.find((account) => account instanceof Error)
      if (unavailable instanceof Error) return { ok: false, cause: unavailable }

      return {
        ok: true,
        records: rows.results.map((row, index) => ({
          link: {
            accountId: restoreWorkforceId("system_account", row.account_id),
            employeeId: toWorkforceEmployeeId(row.employee_id),
          },
          accountEligible:
            !(accounts[index] instanceof Error) && accounts[index]?.status === "active",
        })),
      }
    } catch (cause) {
      return { ok: false, cause }
    }
  }
}
