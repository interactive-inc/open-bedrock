import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { SystemD1Context } from "@system/infrastructure/configuration/system-context.repository"

/** CLI token交換用codeのhashとAccountだけを短期間保存する。 */
export async function createSystemCliLoginCode(
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
      `INSERT INTO system_cli_login_codes
         (code_hash, account_id, created_at, expires_at)
       VALUES (?1, ?2, ?3, ?4)`,
    )
      .bind(input.codeHash, input.accountId, input.createdAt.getTime(), input.expiresAt.getTime())
      .run()
    return null
  } catch (caught) {
    return caught instanceof Error ? caught : new Error("failed to create System CLI login code")
  }
}
