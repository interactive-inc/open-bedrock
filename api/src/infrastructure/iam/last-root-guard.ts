import type { Context } from "@/env"
import { EFFECTIVE_ROOT_PERMISSION_KEYS } from "@/lib/auth/effective-root-permissions"

/**
 * D1 batch 内で、操作後にログイン可能な実効管理者が 0 件になる場合だけ SQLite の評価エラーを
 * 起こして batch 全体を rollback させるガード。
 *
 * 「ログイン可能」は verifyBearer と同じく、active account と退職していない employee の組み合わせ。
 * 「実効管理者」は、1 アカウントが割当ロールの和集合として必須権限を全て持つ状態。
 */
export class LastRootGuard {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  /** 操作後にログイン可能な実効管理者が 1 件も残らないなら batch を rollback させる。 */
  abortWhenNoLoginEnabledEffectiveRoot(): D1PreparedStatement {
    const placeholders = this.effectiveRootPermissionPlaceholders()
    const requiredPermissionCountIndex = EFFECTIVE_ROOT_PERMISSION_KEYS.length + 1

    return this.c.env.DB.prepare(
      `SELECT CASE WHEN NOT EXISTS (
           SELECT 1
           FROM accounts a
           JOIN account_employee_links link ON link.account_id = a.id
           JOIN employees e ON e.id = link.employee_id
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
    ).bind(...EFFECTIVE_ROOT_PERMISSION_KEYS, EFFECTIVE_ROOT_PERMISSION_KEYS.length)
  }

  /**
   * 対象従業員がログイン可能な実効管理者で、かつ退職させると他にログイン可能な実効管理者が
   * 残らない場合だけ batch を rollback させる。
   */
  abortWhenRemovingLoginEnabledEffectiveRootWouldLeaveNone(
    employeeId: number,
  ): D1PreparedStatement {
    const placeholders = this.effectiveRootPermissionPlaceholders()
    const employeeIdIndex = EFFECTIVE_ROOT_PERMISSION_KEYS.length + 1
    const requiredPermissionCountIndex = EFFECTIVE_ROOT_PERMISSION_KEYS.length + 2

    return this.c.env.DB.prepare(
      `SELECT CASE WHEN EXISTS (
           SELECT 1
           FROM accounts target
           JOIN account_employee_links target_link ON target_link.account_id = target.id
           WHERE target_link.employee_id = ?${employeeIdIndex}
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
           JOIN account_employee_links link ON link.account_id = a.id
           JOIN employees e ON e.id = link.employee_id
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
    ).bind(...EFFECTIVE_ROOT_PERMISSION_KEYS, employeeId, EFFECTIVE_ROOT_PERMISSION_KEYS.length)
  }

  /** ガード文が発生させた json_extract('', '$') 由来の意図的な abort かを判定する。 */
  static isAbortedBy(error: unknown): boolean {
    return error instanceof Error && error.message.includes("malformed JSON")
  }

  private effectiveRootPermissionPlaceholders(): string {
    return EFFECTIVE_ROOT_PERMISSION_KEYS.map((_, index) => `?${index + 1}`).join(", ")
  }
}
