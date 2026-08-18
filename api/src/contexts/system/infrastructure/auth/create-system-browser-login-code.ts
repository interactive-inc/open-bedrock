import type { AccountId } from "@system/domain/auth/account-id"
import type { SystemD1Context } from "@system/infrastructure/configuration/system-context"

/** browser token交換用codeのhashとAccountだけを短期間保存する。 */
export async function createSystemBrowserLoginCode(
  context: SystemD1Context,
  input: Readonly<{
    codeHash: string
    accountId: AccountId
    createdAt: Date
    expiresAt: Date
  }>,
): Promise<null | Error> {
  try {
    await context.env.DB.prepare(
      `INSERT INTO system_browser_login_codes
         (code_hash, account_id, created_at, expires_at)
       VALUES (?1, ?2, ?3, ?4)`,
    )
      .bind(input.codeHash, input.accountId, input.createdAt.getTime(), input.expiresAt.getTime())
      .run()
    return null
  } catch (caught) {
    return caught instanceof Error
      ? caught
      : new Error("failed to create System browser login code")
  }
}
