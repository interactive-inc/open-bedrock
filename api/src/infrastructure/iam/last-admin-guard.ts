/**
 * D1 batch 内で、操作後にログイン可能な admin が 0 件になる場合だけ
 * SQLite の評価エラーを起こして batch 全体を rollback させる。
 *
 * 「ログイン可能」は verifyBearer と同じく、active account と退職していない employee の組み合わせ。
 */
export function abortWhenNoLoginEnabledAdmin(db: D1Database): D1PreparedStatement {
  return db.prepare(
    `SELECT CASE WHEN (
       SELECT COUNT(*) FROM account_roles ar
       JOIN roles r ON r.id = ar.role_id
       JOIN accounts a ON a.id = ar.account_id
       JOIN employees e ON e.id = a.employee_id
       WHERE r.key = 'admin'
         AND r.is_system = 1
         AND a.status = 'active'
         AND e.status <> 'retired'
     ) = 0 THEN json_extract('', '$') ELSE 1 END AS ok`,
  )
}

export function abortWhenRemovingLoginEnabledAdminWouldLeaveNone(
  db: D1Database,
  employeeId: number,
): D1PreparedStatement {
  return db
    .prepare(
      `SELECT CASE WHEN EXISTS (
         SELECT 1 FROM account_roles ar
         JOIN roles r ON r.id = ar.role_id
         JOIN accounts a ON a.id = ar.account_id
         WHERE r.key = 'admin'
           AND r.is_system = 1
           AND a.status = 'active'
           AND a.employee_id = ?1
       ) AND (
         SELECT COUNT(*) FROM account_roles ar
         JOIN roles r ON r.id = ar.role_id
         JOIN accounts a ON a.id = ar.account_id
         JOIN employees e ON e.id = a.employee_id
         WHERE r.key = 'admin'
           AND r.is_system = 1
           AND a.status = 'active'
           AND e.status <> 'retired'
       ) = 0 THEN json_extract('', '$') ELSE 1 END AS ok`,
    )
    .bind(employeeId)
}

export function isAbortedByLastAdminGuard(error: unknown): boolean {
  return error instanceof Error && error.message.includes("malformed JSON")
}
