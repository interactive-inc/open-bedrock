import type { Context } from "@/env"
import type { IdentityProvider } from "@/domain/system/auth/identity-provider"
import { identitySubjectSchema } from "@/domain/system/auth/identity-subject"
import { accountEmployeeLinks, accounts, employees, identities } from "@/schema"
import { and, asc, eq, inArray, isNotNull, like, not, sql } from "drizzle-orm"

export type PasswordIdentity = {
  identityId: number
  accountId: number
  secret: string | null
  accountStatus: string
  tokenVersion: number
  employeeId: number | null
}

/** provider+subject で引いた identity と、紐づく account の認証状態。 */
export type ProviderIdentity = {
  identityId: number
  accountId: number
  accountStatus: string
  tokenVersion: number
  employeeId: number | null
  email: string | null
  employeeName: string | null
}

/** レガシー secret 移行バッチが扱う 1 件。 */
export type LegacySecretIdentity = {
  identityId: number
  secret: string
}

/** account を id で直接引いたときの認証に必要な最小情報。 */
export type AccountAuthState = {
  accountId: number
  accountStatus: string
  tokenVersion: number
  employeeId: number | null
}

/**
 * 認証フローが使う identity(ログイン手段)の検索と、紐づく account の取得を扱う。
 * password 認証は (provider="password", subject=正規化email) で引く。
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

      const parsedSubject = identitySubjectSchema.safeParse(email.toLowerCase())
      if (!parsedSubject.success) return null

      const identityRows = await db
        .select()
        .from(identities)
        .where(and(eq(identities.provider, "password"), eq(identities.subject, parsedSubject.data)))
        .limit(1)

      const identity = identityRows.at(0)

      if (identity === undefined) {
        return null
      }

      const accountRows = await db
        .select({
          id: accounts.id,
          status: accounts.status,
          tokenVersion: accounts.tokenVersion,
          employeeId: accountEmployeeLinks.employeeId,
        })
        .from(accounts)
        .leftJoin(accountEmployeeLinks, eq(accountEmployeeLinks.accountId, accounts.id))
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
   * (provider, subject) の identity と、紐づく account の認証状態を引く。不在は null。
   * 外部 identity ログイン（sub で引く）と、プロビジョニングの冪等 upsert で使う。
   */
  async findByProviderSubject(
    provider: IdentityProvider,
    subject: string,
  ): Promise<ProviderIdentity | null | Error> {
    try {
      const db = this.c.var.database
      const parsedSubject = identitySubjectSchema.safeParse(subject)
      if (!parsedSubject.success) return null

      const identityRows = await db
        .select()
        .from(identities)
        .where(and(eq(identities.provider, provider), eq(identities.subject, parsedSubject.data)))
        .limit(1)

      const identity = identityRows.at(0)

      if (identity === undefined) {
        return null
      }

      const accountRows = await db
        .select({
          id: accounts.id,
          status: accounts.status,
          tokenVersion: accounts.tokenVersion,
          employeeId: accountEmployeeLinks.employeeId,
        })
        .from(accounts)
        .leftJoin(accountEmployeeLinks, eq(accountEmployeeLinks.accountId, accounts.id))
        .where(eq(accounts.id, identity.accountId))
        .limit(1)

      const account = accountRows.at(0)

      if (account === undefined) {
        return null
      }

      let employeeName: string | null = null
      if (account.employeeId !== null) {
        const employeeRows = await db
          .select({ name: employees.name })
          .from(employees)
          .where(eq(employees.id, account.employeeId))
          .limit(1)

        employeeName = employeeRows.at(0)?.name ?? null
      }

      return {
        identityId: identity.id,
        accountId: account.id,
        accountStatus: account.status,
        tokenVersion: account.tokenVersion,
        employeeId: account.employeeId,
        email: identity.email,
        employeeName,
      }
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find identity")
    }
  }

  /**
   * email(大小無視)に一致する identity から、紐づく account の id を引く。不在は null。
   * プロビジョニングで「既存従業員を email で探して紐づける」判定に使う。
   */
  async findAccountIdByEmail(email: string): Promise<number | null | Error> {
    try {
      const rows = await this.c.var.database
        .select({ accountId: identities.accountId })
        .from(identities)
        .where(eq(identities.email, email))
        .limit(1)

      return rows.at(0)?.accountId ?? null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find identity by email")
    }
  }

  /**
   * account を id で直接引き、認証に必要な最小情報（status・tokenVersion・employeeId）を返す。不在は null。
   * CLI ログインのように「先に account を解決し、後続のリクエストでセッションを発行する」二段構えの
   * フローで、発行直前に最新状態を再取得する用途に使う。
   */
  async findAccountById(accountId: number): Promise<AccountAuthState | null | Error> {
    try {
      const rows = await this.c.var.database
        .select({
          id: accounts.id,
          status: accounts.status,
          tokenVersion: accounts.tokenVersion,
          employeeId: accountEmployeeLinks.employeeId,
        })
        .from(accounts)
        .leftJoin(accountEmployeeLinks, eq(accountEmployeeLinks.accountId, accounts.id))
        .where(eq(accounts.id, accountId))
        .limit(1)

      const account = rows.at(0)

      if (account === undefined) {
        return null
      }

      return {
        accountId: account.id,
        accountStatus: account.status,
        tokenVersion: account.tokenVersion,
        employeeId: account.employeeId,
      }
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find account")
    }
  }

  /**
   * identity の email を更新し、紐づく account の従業員名も揃える（プロビジョニングの冪等更新）。
   * employeeId が null(システムアカウント等)の場合は名前更新をスキップする。
   */
  async updateProvisionedIdentity(
    identityId: number,
    employeeId: number | null,
    email: string,
    name: string,
  ): Promise<null | Error> {
    try {
      const statements: D1PreparedStatement[] = [
        this.c.env.DB.prepare("UPDATE identities SET email = ?2 WHERE id = ?1").bind(
          identityId,
          email,
        ),
      ]

      if (employeeId !== null) {
        statements.push(
          this.c.env.DB.prepare("UPDATE employees SET name = ?2 WHERE id = ?1").bind(
            employeeId,
            name,
          ),
        )
      }

      await this.c.env.DB.batch(statements)

      return null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to update provisioned identity")
    }
  }

  /**
   * password identity の subject(正規化email)から、紐づく従業員 id を引く。不在は null。
   */
  async findEmployeeIdByEmail(email: string): Promise<number | null | Error> {
    try {
      const db = this.c.var.database

      const subject = identitySubjectSchema.safeParse(email.toLowerCase())
      if (!subject.success) return null

      const rows = await db
        .select({ employeeId: accountEmployeeLinks.employeeId })
        .from(identities)
        .innerJoin(accounts, eq(accounts.id, identities.accountId))
        .innerJoin(accountEmployeeLinks, eq(accountEmployeeLinks.accountId, accounts.id))
        .where(and(eq(identities.provider, "password"), eq(identities.subject, subject.data)))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : row.employeeId
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find identity")
    }
  }

  /**
   * 従業員 id 群について、identity の email を解決する。表示用の写し。
   *
   * provider は絞らない。password を持たない外部 IdP 専用アカウント(oidc のみ)でも
   * email を解決できるようにするため。1 従業員が複数 identity を持つ場合は
   * password を優先し、同 provider 内では identity.id の小さい方(先に作られた方)を採る。
   * ORDER BY で優先度を固定し、Map へは未設定のときだけ書き込むことで結果を決定的にする。
   */
  async findEmailsByEmployeeIds(
    employeeIds: ReadonlyArray<number>,
  ): Promise<Map<number, string> | Error> {
    try {
      if (employeeIds.length === 0) {
        return new Map()
      }

      const rows = await this.c.var.database
        .select({
          employeeId: accountEmployeeLinks.employeeId,
          email: identities.email,
          identityId: identities.id,
          provider: identities.provider,
        })
        .from(identities)
        .innerJoin(accounts, eq(accounts.id, identities.accountId))
        .innerJoin(accountEmployeeLinks, eq(accountEmployeeLinks.accountId, accounts.id))
        .where(inArray(accountEmployeeLinks.employeeId, [...employeeIds]))
        .orderBy(
          // password を先に、次に作成順(id 昇順)。同一従業員の複数 identity で結果を揺らさない。
          sql`CASE WHEN ${identities.provider} = 'password' THEN 0 ELSE 1 END`,
          asc(identities.id),
        )

      const result = new Map<number, string>()

      for (const row of rows) {
        if (row.employeeId === null || row.email === null || row.email.length === 0) {
          continue
        }

        // 先に来た行(優先度の高い identity)を勝たせる。
        if (result.has(row.employeeId)) {
          continue
        }

        result.set(row.employeeId, row.email)
      }

      return result
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to resolve emails")
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
