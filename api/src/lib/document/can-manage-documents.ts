import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 文書台帳の登録・更新を行える権限を持つか判定する。 */
export function canManageDocuments(session: SessionPayload): boolean {
  return hasPermission(session, "document:manage")
}
