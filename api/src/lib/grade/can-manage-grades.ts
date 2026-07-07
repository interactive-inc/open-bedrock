import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 等級マスタと等級の割当を管理できる権限を持つか判定する純粋関数。 */
export function canManageGrades(session: SessionPayload): boolean {
  return hasPermission(session, "grade:manage")
}
