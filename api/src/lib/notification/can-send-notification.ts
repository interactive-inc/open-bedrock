import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 通知を送信できる権限を持つか判定する純粋関数。 */
export function canSendNotification(session: SessionPayload): boolean {
  return hasPermission(session, "notification:send")
}
