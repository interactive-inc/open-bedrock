import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 他者の入社/退職手続きを閲覧する権限判定。閲覧権限を持つ場合のみ許可する純粋関数。 */
export function canViewEmployeeOnboarding(session: SessionPayload): boolean {
  return hasPermission(session, "onboarding:view:all")
}
