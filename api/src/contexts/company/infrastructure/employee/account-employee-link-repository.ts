import type { AccountStatus } from "@/contexts/system/domain/auth/account-status"
import type { Context } from "@/env"
import { accountEmployeeLinks, accounts } from "@/schema"
import { eq } from "drizzle-orm"

export type LinkedEmployeeAccount = Readonly<{
  accountId: number
  status: AccountStatus
  tokenVersion: number
  employeeId: number | null
}>

/** Account と Company の Employee の対応を Company 側で解決する。System 認証はこの対応を知らない。 */
export class AccountEmployeeLinkRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findLinkedAccount(accountId: number): Promise<LinkedEmployeeAccount | null | Error> {
    try {
      const rows = await this.c.var.database
        .select({
          accountId: accounts.id,
          status: accounts.status,
          tokenVersion: accounts.tokenVersion,
          employeeId: accountEmployeeLinks.employeeId,
        })
        .from(accounts)
        .leftJoin(accountEmployeeLinks, eq(accountEmployeeLinks.accountId, accounts.id))
        .where(eq(accounts.id, accountId))
        .limit(1)

      return rows.at(0) ?? null
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
          accountId: accounts.id,
          status: accounts.status,
          tokenVersion: accounts.tokenVersion,
          employeeId: accountEmployeeLinks.employeeId,
        })
        .from(accountEmployeeLinks)
        .innerJoin(accounts, eq(accounts.id, accountEmployeeLinks.accountId))
        .where(eq(accountEmployeeLinks.employeeId, employeeId))
        .limit(1)

      return rows.at(0) ?? null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to resolve employee account link")
    }
  }
}
