import type { Context } from "@/env"
import { identities } from "@/schema/system"
import { and, eq } from "drizzle-orm"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/d1/abort-when-previous-statement-changed-no-rows"

/** 上位contextを知らずにpassword identityの検索とcredential変更を行う。 */
export class PasswordIdentityRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findIdByAccount(accountId: number): Promise<number | null | Error> {
    try {
      const rows = await this.c.var.database
        .select({ id: identities.id })
        .from(identities)
        .where(and(eq(identities.accountId, accountId), eq(identities.provider, "password")))
        .limit(1)

      return rows.at(0)?.id ?? null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find password identity")
    }
  }

  async updateSecretAndBumpTokenVersion(
    identityId: number,
    secret: string,
    accountId: number,
    now: number,
    auditStatements: ReadonlyArray<D1PreparedStatement>,
  ): Promise<null | Error> {
    try {
      const db = this.c.env.DB
      const statements = [
        db
          .prepare(
            "UPDATE identities SET secret = ?2 WHERE id = ?1 AND account_id = ?3 AND provider = 'password'",
          )
          .bind(identityId, secret, accountId),
        abortWhenPreviousStatementChangedNoRows(db),
        db
          .prepare(
            "UPDATE accounts SET token_version = token_version + 1, updated_at = ?2 WHERE id = ?1",
          )
          .bind(accountId, now),
        abortWhenPreviousStatementChangedNoRows(db),
        ...auditStatements,
      ]
      const results = await db.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success)) {
        return new Error("password reset batch did not succeed")
      }

      return null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to reset password")
    }
  }
}
