import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/**
 * 全社の申請を横断で閲覧できるか判定する。GET /applications/admin の可否に使う。
 * 承認可否とは別軸で、hr / admin など横断監査を担う役割に付与する `application:read:all` を見る。
 */
export function canViewAllApplications(session: SessionPayload): boolean {
  return hasPermission(session, "application:read:all")
}
