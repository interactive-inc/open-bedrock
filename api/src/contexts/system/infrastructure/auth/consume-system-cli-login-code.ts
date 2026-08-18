import type { AccountId } from "@system/domain/auth/account-id"
import { zAccountId } from "@system/domain/auth/account-id"
import type { SystemD1Context } from "@system/infrastructure/configuration/system-context"

/** 未失効のCLI token交換用codeをDELETE RETURNINGで一度だけ消費する。 */
export async function consumeSystemCliLoginCode(
  context: SystemD1Context,
  codeHash: string,
  now: Date,
): Promise<Readonly<{ accountId: AccountId }> | null | Error> {
  try {
    const row = await context.env.DB.prepare(
      `DELETE FROM system_cli_login_codes
       WHERE code_hash = ?1 AND expires_at > ?2
       RETURNING account_id`,
    )
      .bind(codeHash, now.getTime())
      .first<{ account_id: string }>()
    if (row === null) return null
    const accountId = zAccountId.safeParse(row.account_id)
    return accountId.success
      ? { accountId: accountId.data }
      : new Error("invalid System Account ID")
  } catch (caught) {
    return caught instanceof Error ? caught : new Error("failed to consume System CLI login code")
  }
}
