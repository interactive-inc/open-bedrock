import { EFFECTIVE_ADMIN_PERMISSION_KEYS } from "@/lib/auth/effective-admin-permissions"

/**
 * D1 batch 内で、操作後にログイン可能な実効管理者が 0 件になる場合だけ
 * SQLite の評価エラーを起こして batch 全体を rollback させる。
 *
 * 「ログイン可能」は verifyBearer と同じく、active account と退職していない employee の組み合わせ。
 * 「実効管理者」は、1 アカウントが割当ロールの和集合として必須権限を全て持つ状態。
 */
export function abortWhenNoLoginEnabledEffectiveAdmin(db: D1Database): D1PreparedStatement {
  const placeholders = EFFECTIVE_ADMIN_PERMISSION_KEYS.map((_, index) => `?${index + 1}`).join(", ")
  const requiredPermissionCountIndex = EFFECTIVE_ADMIN_PERMISSION_KEYS.length + 1

  return db
    .prepare(
      `SELECT CASE WHEN NOT EXISTS (
         SELECT 1
         FROM accounts a
         JOIN employees e ON e.id = a.employee_id
         WHERE a.status = 'active'
           AND e.status <> 'retired'
           AND (
             SELECT COUNT(DISTINCT p.key)
             FROM account_roles ar
             JOIN role_permissions rp ON rp.role_id = ar.role_id
             JOIN permissions p ON p.id = rp.permission_id
             WHERE ar.account_id = a.id
               AND p.key IN (${placeholders})
           ) = ?${requiredPermissionCountIndex}
       ) THEN json_extract('', '$') ELSE 1 END AS ok`,
    )
    .bind(...EFFECTIVE_ADMIN_PERMISSION_KEYS, EFFECTIVE_ADMIN_PERMISSION_KEYS.length)
}

export function abortWhenRemovingLoginEnabledEffectiveAdminWouldLeaveNone(
  db: D1Database,
  employeeId: number,
): D1PreparedStatement {
  const placeholders = EFFECTIVE_ADMIN_PERMISSION_KEYS.map((_, index) => `?${index + 1}`).join(", ")
  const employeeIdIndex = EFFECTIVE_ADMIN_PERMISSION_KEYS.length + 1
  const requiredPermissionCountIndex = EFFECTIVE_ADMIN_PERMISSION_KEYS.length + 2

  return db
    .prepare(
      `SELECT CASE WHEN EXISTS (
         SELECT 1
         FROM accounts target
         WHERE target.employee_id = ?${employeeIdIndex}
           AND target.status = 'active'
           AND (
             SELECT COUNT(DISTINCT p.key)
             FROM account_roles ar
             JOIN role_permissions rp ON rp.role_id = ar.role_id
             JOIN permissions p ON p.id = rp.permission_id
             WHERE ar.account_id = target.id
               AND p.key IN (${placeholders})
           ) = ?${requiredPermissionCountIndex}
       ) AND NOT EXISTS (
         SELECT 1
         FROM accounts a
         JOIN employees e ON e.id = a.employee_id
         WHERE a.status = 'active'
           AND e.status <> 'retired'
           AND (
             SELECT COUNT(DISTINCT p.key)
             FROM account_roles ar
             JOIN role_permissions rp ON rp.role_id = ar.role_id
             JOIN permissions p ON p.id = rp.permission_id
             WHERE ar.account_id = a.id
               AND p.key IN (${placeholders})
           ) = ?${requiredPermissionCountIndex}
       ) THEN json_extract('', '$') ELSE 1 END AS ok`,
    )
    .bind(...EFFECTIVE_ADMIN_PERMISSION_KEYS, employeeId, EFFECTIVE_ADMIN_PERMISSION_KEYS.length)
}

export function isAbortedByLastAdminGuard(error: unknown): boolean {
  return error instanceof Error && error.message.includes("malformed JSON")
}
