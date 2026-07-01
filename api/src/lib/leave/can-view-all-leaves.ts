import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/**
 * 全社の休暇申請を横断で閲覧できるか判定する。GET /leave/requests/admin の可否に使う。
 * hr / admin など横断監査を担うロールに付与する `leave:read:all` を見る。
 */
export function canViewAllLeaves(session: SessionPayload): boolean {
  return hasPermission(session, "leave:read:all")
}
