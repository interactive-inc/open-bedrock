import { seedEmployees } from "@/api/test/support/company/seed-employees.repository"

/** 認証・認可情報を持つ seed 従業員の最小形。 */
export type IamSeedEmployee = {
  id: number
  email: string
  passwordHash: string
  role: string
}

/**
 * テスト用: 従業員seedに対応するcanonical System Account / Identity / Role bindingを生成する。
 * account.idはemployee.idと同値に固定し、
 * テストが createTestToken({ employeeId }) で作るトークンの accountId と一致させる。
 * 認証・認可はSystem、人物はCompanyを正とする。
 */
export async function seedIamForEmployees(
  db: D1Database,
  employees: ReadonlyArray<IamSeedEmployee> = seedEmployees,
): Promise<void> {
  for (const employee of employees) {
    // account.id = employee.id に固定して 1:1。token_version は 0。
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
         VALUES (?1, ?2)`,
      )
      .bind(String(employee.id), employee.id)
      .run()

    await db
      .prepare(
        `INSERT OR IGNORE INTO company_account_profiles
           (organization_id, account_id, display_name, created_at, updated_at)
         SELECT 'organization:default', ?1, name, 0, 0
         FROM employees
         WHERE id = ?2`,
      )
      .bind(String(employee.id), employee.id)
      .run()

    await db
      .prepare(
        `INSERT OR IGNORE INTO system_identity_bindings
           (id, account_id, provider, subject, created_at, activated_at, revoked_at)
         VALUES ('password:' || ?1, ?1, 'password', lower(?2), 0, 0, NULL)`,
      )
      .bind(String(employee.id), employee.email)
      .run()

    await db
      .prepare(
        `INSERT OR IGNORE INTO system_identity_profiles
           (identity_id, email, email_verified, last_used_at, updated_at)
         VALUES ('password:' || ?1, ?2, 1, NULL, 0)`,
      )
      .bind(String(employee.id), employee.email)
      .run()

    await db
      .prepare(
        `INSERT OR IGNORE INTO system_password_credentials
           (identity_id, password_hash, changed_at, created_at, updated_at)
         VALUES ('password:' || ?1, ?2, 0, 0, 0)`,
      )
      .bind(String(employee.id), employee.passwordHash)
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
