import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** ダッシュボードの全社集計を閲覧できる権限を持つか判定する純粋関数。 */
export function canViewDashboard(session: SessionPayload): boolean {
  return hasPermission(session, "dashboard:view")
}
