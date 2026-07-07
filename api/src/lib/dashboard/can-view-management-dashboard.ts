import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 経営ダッシュボードの横断集計を閲覧できる権限を持つか判定する純粋関数。 */
export function canViewManagementDashboard(session: SessionPayload): boolean {
  return hasPermission(session, "management_dashboard:view")
}
