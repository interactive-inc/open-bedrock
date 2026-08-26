import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { SystemD1Context } from "@system/configuration/system-context"
type Context = SystemD1Context

/** 未失効のbrowser token交換用codeをDELETE RETURNINGで一度だけ消費する。 */
export class ConsumeSystemBrowserLoginCodeAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async consumeSystemBrowserLoginCode(
    codeHash: string,
    now: Date,
  ): Promise<Readonly<{ accountId: AccountId }> | null | Error> {
    try {
      const row = await this.c.env.DB.prepare(
        `DELETE FROM system_browser_login_codes
       WHERE code_hash = ?1 AND expires_at > ?2
       RETURNING account_id`,
      )
        .bind(codeHash, now.getTime())
        .first<{ account_id: string }>()
      if (row === null) return null
      const accountId = zAccountId.safeParse(row.account_id)
      return accountId.success
        ? { accountId: accountId.data }
        : new Error("invalid System AccountEntity ID")
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to consume System browser login code")
    }
  }
}
