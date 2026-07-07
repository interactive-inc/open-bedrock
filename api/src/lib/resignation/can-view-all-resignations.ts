import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/**
 * 全社の退職手続きを横断で閲覧できるか判定する。GET /resignations/admin の可否に使う。
 * hr / admin / auditor など横断監査を担うロールに付与する `resignation:read:all` を見る。
 */
export function canViewAllResignations(session: SessionPayload): boolean {
  return hasPermission(session, "resignation:read:all")
}
