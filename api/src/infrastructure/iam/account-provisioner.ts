import type { Context } from "@/env"
import type { IdentityProvider } from "@/lib/schemas"
import { accountEmployeeLinks, accountRoles, accounts, identities, roles } from "@/schema"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/d1/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/d1/is-aborted-by-guard"
import { LivePermissionGuard } from "@/infrastructure/iam/live-permission-guard"
import { RoleAssignmentGuardError } from "@/infrastructure/iam/role-assignment-guard-error"
import { eq } from "drizzle-orm"

export type ProvisionInput = {
  employeeId: number
  email: string
  /** 認証方式。password は secret に PBKDF2、外部 IdP(oidc 等)は secret を持たない。 */
  provider: IdentityProvider
  /** password 認証のハッシュ。secret を持たない外部 IdP では null。 */
  secret: string | null
  /** identity の subject。password は正規化 email、外部 IdP は IdP の sub。 */
  subject: string
  roleKey: string
  now: number
}

/** 外部 identity provider から新規従業員一式(code なし)を払い出すための入力。 */
export type ProvisionExternalEmployeeInput = {
  provider: IdentityProvider
  subject: string
  email: string
  name: string
  roleKey: string
  now: number
}

/** 既存アカウントへ外部 identity を 1 件追加するための入力。 */
export type AttachExternalIdentityInput = {
  accountId: number
  provider: IdentityProvider
  subject: string
  email: string
  now: number
}

export type ProvisionWithEmployeeInput = {
  employee: {
    code: string
    name: string
    deptId: number | null
    deptName: string | null
    position: string | null
    status: string
  }
  email: string
  passwordHash: string
  roleKey: string
  grantedByAccountId: number
  now: number
}

export type PreparedProvisionInput = {
  employeeCode: string
  email: string
  passwordHash: string
  roleKey: string
  grantedByAccountId: number
  now: number
}

/**
 * 従業員のアカウント・identity・初期ロールを払い出す。
 * 新規従業員登録(register-employee)が認証情報を identities へ書くために使う。
 * backfill(0005_iam_backfill.sql)のアプリ層版で、employees の認証列に依存しない。
 */
export class AccountProvisioner {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async provision(input: ProvisionInput): Promise<null | Error> {
    try {
      const db = this.c.var.database

      const accountRows = await db
        .insert(accounts)
        .values({
          status: "active",
          tokenVersion: 0,
          createdAt: input.now,
          updatedAt: input.now,
        })
        .returning()

      const account = accountRows.at(0)

      if (account === undefined) {
        return new Error("failed to create account")
      }

      await db.insert(accountEmployeeLinks).values({
        accountId: account.id,
        employeeId: input.employeeId,
      })

      await db.insert(identities).values({
        accountId: account.id,
        provider: input.provider,
        subject: input.subject,
        secret: input.secret,
        email: input.email,
        emailVerified: 1,
        createdAt: input.now,
      })

      const roleRows = await db.select().from(roles).where(eq(roles.key, input.roleKey)).limit(1)

      const role = roleRows.at(0)

      if (role !== undefined) {
        await db.insert(accountRoles).values({
          accountId: account.id,
          roleId: role.id,
          grantedBy: null,
          grantedAt: input.now,
        })
      }

      return null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to provision account")
    }
  }

  /**
   * 外部 identity provider から、社員コードを持たない従業員一式(employee/account/identity/role)を
   * 単一の D1 batch でアトミックに払い出す。途中失敗は batch 全体を rollback し孤立レコードを防ぐ。
   * code は null。secret は持たず(email_verified=1)、provider は外部 IdP。
   * 付与ロールが存在しない場合は最後の guard で batch 全体を中止する。
   * 作成した employee の id を返す。
   */
  async provisionExternalEmployee(input: ProvisionExternalEmployeeInput): Promise<number | Error> {
    try {
      const db = this.c.env.DB

      const statements: D1PreparedStatement[] = [
        // 1. employee を作成する（code は null）。
        db
          .prepare("INSERT INTO employees (code, name, status) VALUES (NULL, ?1, 'active')")
          .bind(input.name),

        // 2. System account を作成する。
        db
          .prepare(
            `INSERT INTO accounts (status, token_version, created_at, updated_at)
             VALUES ('active', 0, ?1, ?1)`,
          )
          .bind(input.now),

        // 3. Company 所有の account / employee 対応を作る。
        db.prepare(
          `INSERT INTO account_employee_links (account_id, employee_id)
           VALUES (
             last_insert_rowid(),
             (SELECT id FROM employees WHERE code IS NULL ORDER BY id DESC LIMIT 1)
           )`,
        ),

        // 4. identity を account / employee 対応から解決して作成する。
        db
          .prepare(
            `INSERT INTO identities
               (account_id, provider, subject, secret, email, email_verified, created_at)
             VALUES (
               (
                 SELECT account_id
                 FROM account_employee_links
                 WHERE employee_id = (
                   SELECT id FROM employees WHERE code IS NULL ORDER BY id DESC LIMIT 1
                 )
               ),
               ?1, ?2, NULL, ?3, 1, ?4
             )`,
          )
          .bind(input.provider, input.subject, input.email, input.now),

        // 5. account_role を作成する。account は subject 経由で逆引きし、role 不在なら 0 行。
        db
          .prepare(
            `INSERT INTO account_roles (account_id, role_id, granted_by, granted_at)
             SELECT identity.account_id, role.id, NULL, ?3
             FROM identities identity
             JOIN roles role ON role.key = ?2
             WHERE identity.provider = ?4 AND identity.subject = ?1`,
          )
          .bind(input.subject, input.roleKey, input.now, input.provider),

        // role 不在なら直前 INSERT は 0 行。孤立した employee/account/identity も rollback する。
        abortWhenPreviousStatementChangedNoRows(db),
      ]

      const results = await db.batch(statements)

      const employeeId = results[0]?.meta?.last_row_id

      if (employeeId === undefined) {
        return new Error("failed to retrieve employee id from batch")
      }

      return employeeId
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to provision external employee")
    }
  }

  /**
   * 既存アカウントへ外部 identity を 1 件追加する（email で既存従業員に見つかった場合の紐付け）。
   * (provider, subject) の一意制約により、同じ外部 identity の二重紐付けは失敗する。
   */
  async attachExternalIdentity(input: AttachExternalIdentityInput): Promise<null | Error> {
    try {
      await this.c.var.database.insert(identities).values({
        accountId: input.accountId,
        provider: input.provider,
        subject: input.subject,
        secret: null,
        email: input.email,
        emailVerified: 1,
        createdAt: input.now,
      })

      return null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to attach external identity")
    }
  }

  prepareProvisionByEmployeeCode(
    input: PreparedProvisionInput,
  ): ReadonlyArray<D1PreparedStatement> {
    const db = this.c.env.DB
    return [
      db
        .prepare(
          `INSERT INTO accounts (status, token_version, created_at, updated_at)
           SELECT 'active', 0, ?2, ?2 FROM employees WHERE code = ?1
           RETURNING id`,
        )
        .bind(input.employeeCode, input.now),
      abortWhenPreviousStatementChangedNoRows(db),
      db
        .prepare(
          `INSERT INTO account_employee_links (account_id, employee_id)
           SELECT last_insert_rowid(), id FROM employees WHERE code = ?1
           RETURNING account_id`,
        )
        .bind(input.employeeCode),
      abortWhenPreviousStatementChangedNoRows(db),
      db
        .prepare(
          `INSERT INTO identities
             (account_id, provider, subject, secret, email, email_verified, created_at)
           SELECT account.id, 'password', ?2, ?3, ?4, 1, ?5
           FROM accounts account
           INNER JOIN account_employee_links link ON link.account_id = account.id
           INNER JOIN employees employee ON employee.id = link.employee_id
           WHERE employee.code = ?1
           RETURNING account_id`,
        )
        .bind(
          input.employeeCode,
          input.email.toLowerCase(),
          input.passwordHash,
          input.email,
          input.now,
        ),
      abortWhenPreviousStatementChangedNoRows(db),
      new LivePermissionGuard(this.c).abortWhenActorCannotManageRoleByKey({
        actorAccountId: input.grantedByAccountId,
        targetRoleKey: input.roleKey,
        requiredPermissionKeys:
          input.roleKey === "member"
            ? ["employee:create", "employee:lifecycle:apply", "account:manage"]
            : [
                "employee:create",
                "employee:lifecycle:apply",
                "account:manage",
                "employee:assign_role",
              ],
      }),
      db
        .prepare(
          `INSERT INTO account_roles (account_id, role_id, granted_by, granted_at)
           SELECT account.id, role.id, ?3, ?4
           FROM accounts account
           INNER JOIN account_employee_links link ON link.account_id = account.id
           INNER JOIN employees employee ON employee.id = link.employee_id
           INNER JOIN roles role ON role.key = ?2
           WHERE employee.code = ?1
           RETURNING account_id`,
        )
        .bind(input.employeeCode, input.roleKey, input.grantedByAccountId, input.now),
      abortWhenPreviousStatementChangedNoRows(db),
    ]
  }

  /**
   * employee / account / identity / account_role を単一の D1 batch で一括作成する。
   * 途中失敗時は batch 全体が rollback され、孤立レコードを防ぐ。
   * employee code をサブクエリのキーに使い、前段 INSERT の ID を後段で参照する。
   */
  async provisionWithEmployee(input: ProvisionWithEmployeeInput): Promise<number | Error> {
    try {
      const db = this.c.env.DB

      const statements: D1PreparedStatement[] = [
        // 1. employee を作成する
        db
          .prepare(
            "INSERT INTO employees (code, name, dept_id, dept_name, position, status) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
          )
          .bind(
            input.employee.code,
            input.employee.name,
            input.employee.deptId,
            input.employee.deptName,
            input.employee.position,
            input.employee.status,
          ),

        // 2. System account を作成する
        db
          .prepare(
            `INSERT INTO accounts (status, token_version, created_at, updated_at)
             SELECT 'active', 0, ?2, ?2 FROM employees WHERE code = ?1`,
          )
          .bind(input.employee.code, input.now),

        // 3. Company 所有の account / employee 対応を作る
        db
          .prepare(
            `INSERT INTO account_employee_links (account_id, employee_id)
             SELECT last_insert_rowid(), id FROM employees WHERE code = ?1`,
          )
          .bind(input.employee.code),

        // 4. identity を作成する（account_id は link 経由で逆引き）
        db
          .prepare(
            `INSERT INTO identities (account_id, provider, subject, secret, email, email_verified, created_at)
           VALUES (
             (
               SELECT link.account_id
               FROM account_employee_links link
               JOIN employees employee ON employee.id = link.employee_id
               WHERE employee.code = ?1
             ),
             'password', ?2, ?3, ?4, 1, ?5
           )`,
          )
          .bind(
            input.employee.code,
            input.email.toLowerCase(),
            input.passwordHash,
            input.email,
            input.now,
          ),

        // 5. 認証時点の session ではなく、この batch の DB snapshot で付与者を再認可する。
        new LivePermissionGuard(this.c).abortWhenActorCannotManageRoleByKey({
          actorAccountId: input.grantedByAccountId,
          targetRoleKey: input.roleKey,
          requiredPermissionKeys:
            input.roleKey === "member"
              ? ["employee:create"]
              : ["employee:create", "employee:assign_role"],
        }),

        // 6. account_role を作成する。role 不在・live 権限不足は直前の guard が中止する。
        db
          .prepare(
            `INSERT INTO account_roles (account_id, role_id, granted_by, granted_at)
             SELECT a.id, r.id, ?3, ?4
             FROM accounts a
             JOIN account_employee_links link ON link.account_id = a.id
             JOIN employees e ON e.id = link.employee_id
             JOIN roles r ON r.key = ?2
             WHERE e.code = ?1`,
          )
          .bind(input.employee.code, input.roleKey, input.grantedByAccountId, input.now),

        // role 不在・権限超過なら直前 INSERT は 0 行。孤立した employee/account/identity も rollback する。
        abortWhenPreviousStatementChangedNoRows(db),
      ]

      const results = await db.batch(statements)

      // employees INSERT の結果から employee ID を取得する
      const employeeId = results[0]?.meta?.last_row_id

      if (employeeId === undefined) {
        return new Error("failed to retrieve employee id from batch")
      }

      return employeeId
    } catch (caught) {
      if (LivePermissionGuard.isAbortedBy(caught) || isAbortedByGuard(caught)) {
        return new RoleAssignmentGuardError({ cause: caught })
      }

      return caught instanceof Error
        ? caught
        : new Error("failed to provision employee with account")
    }
  }
}
