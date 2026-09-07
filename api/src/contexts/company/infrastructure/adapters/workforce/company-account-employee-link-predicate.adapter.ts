import { sql, type SQL, type SQLWrapper } from "drizzle-orm"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"

type Context = Readonly<{ asOf: CalendarDate } | { now: Date; timeZone: string | undefined }>

/** 既存の対応表を参照するjoinにも、公開履歴の終了・取消・将来予約を適用する。 */
export class CompanyAccountEmployeeLinkPredicateAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  matches(columns: Readonly<{ accountId: SQLWrapper; employeeId: SQLWrapper }>): SQL {
    const asOf =
      "asOf" in this.c
        ? this.c.asOf
        : resolveCompanyBusinessDate({
            now: this.c.now.toISOString(),
            timeZone: this.c.timeZone,
          })
    if (asOf instanceof Error) throw asOf
    return sql`EXISTS (SELECT 1 FROM company_account_employee_link_periods effective_link
      WHERE effective_link.account_id = ${columns.accountId} AND effective_link.employee_id = ${columns.employeeId}
        AND (effective_link.starts_on IS NULL OR effective_link.starts_on <= ${asOf})
        AND (effective_link.ends_on IS NULL OR ${asOf} < effective_link.ends_on))`
  }
}
