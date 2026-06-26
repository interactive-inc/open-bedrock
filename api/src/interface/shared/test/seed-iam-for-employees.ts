// テスト用: 既存 employees に対応する accounts/identities/account_roles を生成する。
// 本番の backfill(0005_iam_backfill.sql)のテスト版。account.id は employee.id と同値に固定し、
// テストが createTestToken({ employeeId }) で作るトークンの accountId と一致させる。
// roles/permissions のマスタは loadSchema(0004) で投入済み前提。
export async function seedIamForEmployees(db: D1Database): Promise<void> {
  // account.id = employee.id に固定して 1:1。token_version は 0。
  await db
    .prepare(
      `INSERT OR IGNORE INTO accounts (id, employee_id, status, token_version, created_at, updated_at)
       SELECT e.id, e.id, 'active', 0, 0, 0 FROM employees e`,
    )
    .run()

  await db
    .prepare(
      `INSERT OR IGNORE INTO identities (account_id, provider, subject, secret, email, email_verified, created_at)
       SELECT e.id, 'password', lower(e.email), e.password_hash, e.email, 1, 0 FROM employees e`,
    )
    .run()

  await db
    .prepare(
      `INSERT OR IGNORE INTO account_roles (account_id, role_id, granted_by, granted_at)
       SELECT e.id, r.id, NULL, 0 FROM employees e JOIN roles r ON r.key = e.role AND r.is_system = 1`,
    )
    .run()
}
