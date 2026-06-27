import type { Context } from "@/env"
import { accounts, identities } from "@/schema"
import { and, eq, inArray, isNotNull, like, not } from "drizzle-orm"

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

// レガシー secret 移行バッチが扱う 1 件。
export type LegacySecretIdentity = {
  identityId: number
  secret: string
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
   * password identity の subject(正規化email)から、紐づく従業員 id を引く。不在は null。
   */
  async findEmployeeIdByEmail(email: string): Promise<number | null | Error> {
    try {
      const db = this.c.var.database

      const subject = email.toLowerCase()

      const rows = await db
        .select({ employeeId: accounts.employeeId })
        .from(identities)
        .innerJoin(accounts, eq(accounts.id, identities.accountId))
        .where(and(eq(identities.provider, "password"), eq(identities.subject, subject)))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : row.employeeId
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find identity")
    }
  }

  /**
   * 従業員 id 群について、password identity の email を解決する。表示用の写し。
   */
  async findEmailsByEmployeeIds(
    employeeIds: ReadonlyArray<number>,
  ): Promise<Map<number, string> | Error> {
    try {
      if (employeeIds.length === 0) {
        return new Map()
      }

      const rows = await this.c.var.database
        .select({ employeeId: accounts.employeeId, email: identities.email })
        .from(identities)
        .innerJoin(accounts, eq(accounts.id, identities.accountId))
        .where(
          and(eq(identities.provider, "password"), inArray(accounts.employeeId, [...employeeIds])),
        )

      const result = new Map<number, string>()

      for (const row of rows) {
        if (row.employeeId !== null && row.email !== null) {
          result.set(row.employeeId, row.email)
        }
      }

      return result
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to resolve emails")
    }
  }

  /**
   * account の password identity の id を返す。不在は null。
   */
  async findPasswordIdentityIdByAccount(accountId: number): Promise<number | null | Error> {
    try {
      const rows = await this.c.var.database
        .select({ id: identities.id })
        .from(identities)
        .where(and(eq(identities.accountId, accountId), eq(identities.provider, "password")))
        .limit(1)

      return rows.at(0)?.id ?? null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find identity")
    }
  }

  /**
   * password identity の secret(PBKDF2)を書き戻す(レガシーハッシュ昇格・パスワード再設定)。
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

  /**
   * secret が純正 PBKDF2 形式でない password identity を全件返す。
   * 旧形式(hex)とラップ済み旧形式(pbkdf2-wrapped-legacy:)が対象。
   */
  async findPasswordIdentitiesWithNonPbkdf2Secret(): Promise<
    ReadonlyArray<LegacySecretIdentity> | Error
  > {
    try {
      const rows = await this.c.var.database
        .select({ id: identities.id, secret: identities.secret })
        .from(identities)
        .where(
          and(
            eq(identities.provider, "password"),
            isNotNull(identities.secret),
            not(like(identities.secret, "pbkdf2:%")),
          ),
        )

      return rows
        .filter((row): row is { id: number; secret: string } => row.secret !== null)
        .map((row) => ({ identityId: row.id, secret: row.secret }))
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to load identities with legacy secret")
    }
  }
}
