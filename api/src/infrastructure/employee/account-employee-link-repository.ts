import type { Context } from "@/env"
import { accounts } from "@/schema"
import { eq } from "drizzle-orm"

export type LinkedEmployeeAccount = Readonly<{
  accountId: number
  status: string
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
          employeeId: accounts.employeeId,
        })
        .from(accounts)
        .where(eq(accounts.id, accountId))
        .limit(1)

      return rows.at(0) ?? null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to resolve account employee link")
    }
  }
}
