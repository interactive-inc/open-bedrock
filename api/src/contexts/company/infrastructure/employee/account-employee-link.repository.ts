import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { CompanyContext } from "@/contexts/company/infrastructure/configuration/company-context.repository"
import { accountEmployeeLinks } from "@/contexts/company/infrastructure/schema/employee"
import { eq } from "drizzle-orm"

export type LinkedEmployeeAccount = Readonly<{
  accountId: AccountId
  employeeId: number
}>

/** Account と Company の Employee の対応を Company 側で解決する。System 認証はこの対応を知らない。 */
export class AccountEmployeeLinkRepository {
  constructor(private readonly c: CompanyContext) {
    Object.freeze(this)
  }

  async findLinkedAccount(accountId: AccountId): Promise<LinkedEmployeeAccount | null | Error> {
    try {
      const rows = await this.c.var.database
        .select({
          accountId: accountEmployeeLinks.accountId,
          employeeId: accountEmployeeLinks.employeeId,
        })
        .from(accountEmployeeLinks)
        .where(eq(accountEmployeeLinks.accountId, accountId))
        .limit(1)

      const row = rows.at(0)
      if (row === undefined) return null
      return row
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to resolve account employee link")
    }
  }

  async findLinkedAccountByEmployeeId(
    employeeId: number,
  ): Promise<LinkedEmployeeAccount | null | Error> {
    try {
      const rows = await this.c.var.database
        .select({
          accountId: accountEmployeeLinks.accountId,
          employeeId: accountEmployeeLinks.employeeId,
        })
        .from(accountEmployeeLinks)
        .where(eq(accountEmployeeLinks.employeeId, employeeId))
        .limit(1)

      const row = rows.at(0)
      if (row === undefined) return null
      return row
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to resolve employee account link")
    }
  }
}
