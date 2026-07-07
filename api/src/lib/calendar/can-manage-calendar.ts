import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 会社カレンダー（会社休日・振替出勤日）を管理できる権限を持つか判定する純粋関数。 */
export function canManageCalendar(session: SessionPayload): boolean {
  return hasPermission(session, "calendar:manage")
}
