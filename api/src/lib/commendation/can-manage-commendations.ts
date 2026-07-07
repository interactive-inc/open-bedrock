import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 表彰の記録を登録・削除できる権限を持つか判定する。閲覧は全認証者に開く（社内公開）。 */
export function canManageCommendations(session: SessionPayload): boolean {
  return hasPermission(session, "commendation:manage")
}
