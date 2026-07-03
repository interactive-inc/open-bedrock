import type { Context } from "@/env"
import { accountRoles, accounts, identities, roles } from "@/schema"
import { eq } from "drizzle-orm"

// 従業員に対応する account / password identity / 初期ロールを作成する。
// 新規従業員登録(register-employee)が認証情報を identities へ書くために使う。
// backfill(0005_iam_backfill.sql)のアプリ層版で、employees の認証列に依存しない。

export type ProvisionInput = {
  employeeId: number
  email: string
  passwordHash: string
  roleKey: string
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
  now: number
}

/**
 * 従業員のアカウント・identity・初期ロールを払い出す。
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
          employeeId: input.employeeId,
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

      await db.insert(identities).values({
        accountId: account.id,
        provider: "password",
        subject: input.email.toLowerCase(),
        secret: input.passwordHash,
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

        // 2. account を作成する（employee_id は code で逆引き）
        db
          .prepare(
            `INSERT INTO accounts (employee_id, status, token_version, created_at, updated_at)
           VALUES ((SELECT id FROM employees WHERE code = ?1), 'active', 0, ?2, ?2)`,
          )
          .bind(input.employee.code, input.now),

        // 3. identity を作成する（account_id は employee code 経由で逆引き）
        db
          .prepare(
            `INSERT INTO identities (account_id, provider, subject, secret, email, email_verified, created_at)
           VALUES (
             (SELECT a.id FROM accounts a JOIN employees e ON e.id = a.employee_id WHERE e.code = ?1),
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

        // 4. account_role を作成する（role が存在する場合のみ挿入されるよう INSERT ... SELECT で制御）
        db
          .prepare(
            `INSERT INTO account_roles (account_id, role_id, granted_by, granted_at)
           SELECT a.id, r.id, NULL, ?3
           FROM accounts a
           JOIN employees e ON e.id = a.employee_id
           JOIN roles r ON r.key = ?2
           WHERE e.code = ?1`,
          )
          .bind(input.employee.code, input.roleKey, input.now),
      ]

      const results = await db.batch(statements)

      // employees INSERT の結果から employee ID を取得する
      const employeeId = results[0]?.meta?.last_row_id

      if (employeeId === undefined) {
        return new Error("failed to retrieve employee id from batch")
      }

      return employeeId
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to provision employee with account")
    }
  }
}
