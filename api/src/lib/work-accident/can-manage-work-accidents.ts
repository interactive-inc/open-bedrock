import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/**
 * 労災・事故の発生記録を登録／クローズできる権限（work_accident:manage）を持つか判定する。
 */
export function canManageWorkAccidents(session: SessionPayload): boolean {
  return hasPermission(session, "work_accident:manage")
}
