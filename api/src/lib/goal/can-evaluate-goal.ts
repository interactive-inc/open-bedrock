import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 目標の manager/final 評価ができる権限を持つか判定する純粋関数。 */
export function canEvaluateGoal(session: SessionPayload): boolean {
  return hasPermission(session, "goal:evaluate")
}
