import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 人員計画を閲覧できる権限を持つか判定する（経営・監査など read:all 保持者）。 */
export function canReadHeadcountPlans(session: SessionPayload): boolean {
  return hasPermission(session, "headcount_plan:read:all")
}
