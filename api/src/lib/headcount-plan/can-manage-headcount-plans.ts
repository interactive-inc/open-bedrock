import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 人員計画を登録・更新できる権限を持つか判定する。 */
export function canManageHeadcountPlans(session: SessionPayload): boolean {
  return hasPermission(session, "headcount_plan:manage")
}
