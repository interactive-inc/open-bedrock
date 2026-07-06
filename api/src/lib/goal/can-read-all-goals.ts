import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 他者の目標を閲覧できる権限を持つか判定する純粋関数。 */
export function canReadAllGoals(session: SessionPayload): boolean {
  return hasPermission(session, "goal:read:all")
}
