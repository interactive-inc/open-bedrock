import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/**
 * 全社の産休・育休・介護休業の申出を横断で閲覧できるか判定する。GET /family-care-leaves/admin の可否に使う。
 * hr / admin / auditor など横断監査を担うロールに付与する `family_care_leave:read:all` を見る。
 */
export function canViewAllFamilyCareLeaves(session: SessionPayload): boolean {
  return hasPermission(session, "family_care_leave:read:all")
}
