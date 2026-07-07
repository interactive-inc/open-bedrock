import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 全社の予算枠を横断で閲覧できるか判定する。GET /budgets の可否に使う。 */
export function canViewAllBudgets(session: SessionPayload): boolean {
  return hasPermission(session, "budget:read:all")
}
