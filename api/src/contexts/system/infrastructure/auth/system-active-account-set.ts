import type { AccountId } from "@system/domain/auth/account-id"
import type { SystemD1Context } from "@system/infrastructure/configuration/system-context"

/** 指定された一意Account ID集合がすべてactiveかを一回のbounded queryで検証する。 */
export class SystemActiveAccountSet {
  constructor(private readonly context: SystemD1Context) {
    Object.freeze(this)
  }

  async containsAll(accountIds: ReadonlyArray<AccountId>): Promise<boolean | Error> {
    const uniqueAccountIds = [...new Set(accountIds)]
    if (uniqueAccountIds.length === 0 || uniqueAccountIds.length > 100) return false

    try {
      const total = await this.context.env.DB.prepare(
        `SELECT count(*) AS total
         FROM system_accounts
         WHERE status = 'active'
           AND id IN (SELECT value FROM json_each(?1))`,
      )
        .bind(JSON.stringify(uniqueAccountIds))
        .first<number>("total")

      return total === uniqueAccountIds.length
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to verify active System Accounts")
    }
  }
}
