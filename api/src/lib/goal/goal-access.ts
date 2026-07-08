import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

export type Forbidden = { reason: "forbidden" }

/** 他者の目標を閲覧できるか。permission ベースで判定する。 */
export function canViewOthers(session: SessionPayload): boolean {
  return hasPermission(session, "goal:read:all")
}

/** 上長として目標を評価できるか。permission ベースで判定する。 */
export function canEvaluateAsManager(session: SessionPayload): boolean {
  return hasPermission(session, "goal:evaluate")
}
