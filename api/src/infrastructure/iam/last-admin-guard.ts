import { isAbortedByGuard } from "@/lib/d1/batch-abort-guard"

/**
 * batch 内の直前までの変更を反映した状態で、ログイン可能な admin が 0 件なら rollback する。
 * ログイン可能性は active account + system admin role + retired でない employee で判定する。
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
         AND e.status != 'retired'
     ) = 0 THEN json_extract('', '$') ELSE 1 END AS ok`,
  )
}

export function isAbortedByLastAdminGuard(error: unknown): boolean {
  return isAbortedByGuard(error)
}
