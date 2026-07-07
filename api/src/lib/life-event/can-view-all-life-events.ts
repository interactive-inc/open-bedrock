import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/**
 * 全社のライフイベント届を横断で閲覧できるか判定する。GET /life-events/admin の可否に使う。
 * hr / admin / auditor など横断監査を担うロールに付与する `life_event:read:all` を見る。
 */
export function canViewAllLifeEvents(session: SessionPayload): boolean {
  return hasPermission(session, "life_event:read:all")
}
