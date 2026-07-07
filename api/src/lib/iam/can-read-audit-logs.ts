import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 監査ログを閲覧できる権限を持つか判定する純粋関数。 */
export function canReadAuditLogs(session: SessionPayload): boolean {
  return hasPermission(session, "audit_log:read")
}
