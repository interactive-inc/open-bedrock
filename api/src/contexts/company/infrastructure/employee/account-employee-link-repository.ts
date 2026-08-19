import type { AccountStatus } from "@/contexts/system/domain/auth/account-status"
import type { AccountId } from "@system/domain/auth/account-id"
import { systemAccounts } from "@system/infrastructure/schema/system-core"
import type { Context } from "@/env"
import { accountEmployeeLinks } from "@/contexts/company/infrastructure/schema/employee"
import { eq } from "drizzle-orm"

export type LinkedEmployeeAccount = Readonly<{
  accountId: AccountId
  status: AccountStatus
  tokenVersion: number
  employeeId: number | null
}>

/** Account と Company の Employee の対応を Company 側で解決する。System 認証はこの対応を知らない。 */
export class AccountEmployeeLinkRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findLinkedAccount(accountId: AccountId): Promise<LinkedEmployeeAccount | null | Error> {
    try {
      const rows = await this.c.var.database
        .select({
          accountId: systemAccounts.id,
          status: systemAccounts.status,
          tokenVersion: systemAccounts.tokenVersion,
          employeeId: accountEmployeeLinks.employeeId,
        })
        .from(systemAccounts)
        .leftJoin(accountEmployeeLinks, eq(accountEmployeeLinks.accountId, systemAccounts.id))
        .where(eq(systemAccounts.id, accountId))
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
          accountId: systemAccounts.id,
          status: systemAccounts.status,
          tokenVersion: systemAccounts.tokenVersion,
          employeeId: accountEmployeeLinks.employeeId,
        })
        .from(accountEmployeeLinks)
        .innerJoin(systemAccounts, eq(systemAccounts.id, accountEmployeeLinks.accountId))
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
