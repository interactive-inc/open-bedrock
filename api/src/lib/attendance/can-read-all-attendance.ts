import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 全従業員の勤怠を閲覧できる権限を持つか判定する純粋関数。 */
export function canReadAllAttendance(session: SessionPayload): boolean {
  return hasPermission(session, "attendance:read:all")
}
