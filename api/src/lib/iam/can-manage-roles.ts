import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** ロールと権限の作成・編集・削除を行える権限を持つか判定する純粋関数。 */
export function canManageRoles(session: SessionPayload): boolean {
  return hasPermission(session, "iam:manage_roles")
}
