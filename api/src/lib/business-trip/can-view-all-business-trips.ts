import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/**
 * 全社の出張申請を横断で閲覧できるか判定する。GET /business-trips/admin の可否に使う。
 * hr / admin / auditor など横断監査を担うロールに付与する `business_trip:read:all` を見る。
 */
export function canViewAllBusinessTrips(session: SessionPayload): boolean {
  return hasPermission(session, "business_trip:read:all")
}
