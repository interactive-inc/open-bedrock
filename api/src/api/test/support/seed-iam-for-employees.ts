import { seedEmployees } from "@/contexts/company-compatibility/infrastructure/seed/seed-employees"

/** 認証・認可情報を持つ seed 従業員の最小形。 */
export type IamSeedEmployee = {
  id: number
  email: string
  passwordHash: string
  role: string
}

/**
 * テスト用: 従業員 seed データに対応する accounts/identities/account_roles を生成する。
 * 本番の backfill(0005_iam_backfill.sql)のテスト版。account.id は employee.id と同値に固定し、
 * テストが createTestToken({ employeeId }) で作るトークンの accountId と一致させる。
 * 認証(email/password)・認可(role)は employees 列ではなく、seed データ(または引数)を正とする。
 * roles/permissions のマスタは loadSchema(0004) で投入済み前提
 */
export async function seedIamForEmployees(
  db: D1Database,
  employees: ReadonlyArray<IamSeedEmployee> = seedEmployees,
): Promise<void> {
  for (const employee of employees) {
    // account.id = employee.id に固定して 1:1。token_version は 0。
    await db
      .prepare(
        `INSERT OR IGNORE INTO accounts (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 0, 0, 0)`,
      )
      .bind(employee.id)
      .run()

    await db
      .prepare(
        `INSERT OR IGNORE INTO system_accounts
           (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 0, 0, 0)`,
      )
      .bind(String(employee.id))
      .run()

    await db
      .prepare(
        `INSERT OR IGNORE INTO account_employee_links (account_id, employee_id)
         VALUES (?1, ?1)`,
      )
      .bind(employee.id)
      .run()

    await db
      .prepare(
        `INSERT OR IGNORE INTO identities (account_id, provider, subject, secret, email, email_verified, created_at)
         VALUES (?1, 'password', lower(?2), ?3, ?2, 1, 0)`,
      )
      .bind(employee.id, employee.email, employee.passwordHash)
      .run()

    await db
      .prepare(
        `INSERT OR IGNORE INTO account_roles (account_id, role_id, granted_by, granted_at)
         SELECT ?1, r.id, NULL, 0 FROM roles r WHERE r.key = ?2 AND r.is_system = 1`,
      )
      .bind(employee.id, employee.role)
      .run()

    await db
      .prepare(
        `INSERT OR IGNORE INTO system_role_bindings
           (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
         SELECT 'test:' || ?1 || ':' || role.id, ?1, role.id,
                NULL, NULL, 0, NULL
         FROM system_iam_roles AS role WHERE role.key = 'company:' || ?2`,
      )
      .bind(String(employee.id), employee.role)
      .run()
  }
}
