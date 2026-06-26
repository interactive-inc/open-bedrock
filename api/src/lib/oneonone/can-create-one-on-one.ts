import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 1on1 を記録できる権限を持つか判定する純粋関数。 */
export function canCreateOneOnOne(session: SessionPayload): boolean {
  return hasPermission(session, "oneonone:create")
}
