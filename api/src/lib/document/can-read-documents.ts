import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 文書台帳を閲覧できる権限を持つか判定する。 */
export function canReadDocuments(session: SessionPayload): boolean {
  return hasPermission(session, "document:read:all")
}
