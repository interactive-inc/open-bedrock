import type { Context } from "@/env"
import { accounts, identities } from "@/schema"
import { and, eq } from "drizzle-orm"

// 認証フローが使う identity(ログイン手段)の検索と、紐づく account の取得。
// password 認証は (provider="password", subject=正規化email) で引く。

export type PasswordIdentity = {
  identityId: number
  accountId: number
  secret: string | null
  accountStatus: string
  tokenVersion: number
  employeeId: number | null
}

/**
 * identity と紐づく account を扱う。
 */
export class IdentityRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  /**
   * 正規化 email(小文字)の password identity と、その account を引く。不在は null。
   */
  async findPasswordIdentityByEmail(email: string): Promise<PasswordIdentity | null | Error> {
    try {
      const db = this.c.var.database

      const subject = email.toLowerCase()

      const identityRows = await db
        .select()
        .from(identities)
        .where(and(eq(identities.provider, "password"), eq(identities.subject, subject)))
        .limit(1)

      const identity = identityRows.at(0)

      if (identity === undefined) {
        return null
      }

      const accountRows = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, identity.accountId))
        .limit(1)

      const account = accountRows.at(0)

      if (account === undefined) {
        return null
      }

      return {
        identityId: identity.id,
        accountId: account.id,
        secret: identity.secret,
        accountStatus: account.status,
        tokenVersion: account.tokenVersion,
        employeeId: account.employeeId,
      }
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find identity")
    }
  }

  /**
   * password identity の secret(PBKDF2)を書き戻す(レガシーハッシュ昇格)。
   */
  async updateSecret(identityId: number, secret: string): Promise<null | Error> {
    try {
      await this.c.var.database
        .update(identities)
        .set({ secret: secret })
        .where(eq(identities.id, identityId))

      return null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to update identity secret")
    }
  }
}
