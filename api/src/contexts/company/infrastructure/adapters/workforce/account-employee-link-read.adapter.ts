import type {
  AccountEmployeeLinkQuery,
  AccountEmployeeLinkReadPort,
  AccountEmployeeLinkReadPortResult,
} from "@/contexts/company/lib/workforce/resolve-account-employee-link"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"

type LinkRow = Readonly<{
  account_id: string
  employee_id: string
}>
type Context = CompanyContext

/** Company が所有する Account と Employee の対応だけを読み取る。 */
export class AccountEmployeeLinkReadAdapter implements AccountEmployeeLinkReadPort {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async find(query: AccountEmployeeLinkQuery): Promise<AccountEmployeeLinkReadPortResult> {
    try {
      const statement = this.c.env.DB.prepare(
        `SELECT account_id, employee_id
         FROM company_account_employee_links
         WHERE ${query.kind === "by_account" ? "account_id = ?1" : "employee_id = ?1"}`,
      ).bind(query.kind === "by_account" ? query.accountId : query.employeeId)
      const rows = await statement.all<LinkRow>()

      return {
        ok: true,
        records: rows.results.map((row) => ({
          link: {
            accountId: restoreWorkforceId("system_account", row.account_id),
            employeeId: restoreWorkforceId("employee", row.employee_id),
          },
        })),
      }
    } catch (cause) {
      return { ok: false, cause }
    }
  }
}
