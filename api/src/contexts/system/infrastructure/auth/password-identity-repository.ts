import type {
  SystemD1Context,
  SystemDatabaseContext,
} from "@system/infrastructure/configuration/system-context"
import type { AccountId } from "@system/domain/auth/account-id"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"

/** password credential変更をAccount token失効と同じtransactionで確定する。 */
export class PasswordIdentityRepository {
  constructor(private readonly c: SystemDatabaseContext & SystemD1Context) {
    Object.freeze(this)
  }

  async findIdByAccount(accountId: AccountId): Promise<string | null | Error> {
    try {
      const id = await this.c.env.DB.prepare(
        `SELECT id FROM system_identity_bindings
         WHERE account_id = ?1 AND provider = 'password' AND revoked_at IS NULL
         LIMIT 1`,
      )
        .bind(accountId)
        .first<string>("id")
      return id
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find password identity")
    }
  }

  async updateSecretAndBumpTokenVersion(
    identityId: string,
    secret: string,
    accountId: AccountId,
    now: number,
    auditStatements: ReadonlyArray<D1PreparedStatement>,
  ): Promise<null | Error> {
    try {
      const db = this.c.env.DB
      const statements = [
        db
          .prepare(
            `UPDATE system_password_credentials
             SET password_hash = ?2, changed_at = max(changed_at + 1, ?4),
                 updated_at = max(updated_at + 1, ?4)
             WHERE identity_id = ?1
               AND EXISTS (
                 SELECT 1 FROM system_identity_bindings
                 WHERE id = ?1 AND account_id = ?3 AND provider = 'password' AND revoked_at IS NULL
               )`,
          )
          .bind(identityId, secret, accountId, now),
        abortWhenPreviousStatementChangedNoRows(db),
        db
          .prepare(
            `UPDATE system_accounts
             SET token_version = token_version + 1, updated_at = max(updated_at, ?2)
             WHERE id = ?1`,
          )
          .bind(accountId, now),
        abortWhenPreviousStatementChangedNoRows(db),
        ...auditStatements,
      ]
      const results = await db.batch(statements)
      return results.length === statements.length && results.every((result) => result.success)
        ? null
        : new Error("password reset batch did not succeed")
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to reset password")
    }
  }
}
