import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/**
 * 全社のサンクス交換申請を横断で閲覧できるか判定する。GET /thanks/redemptions/admin の可否に使う。
 * hr / admin など横断監査を担うロールに付与する `thanks_redemption:read:all` を見る。
 */
export function canViewAllRedemptions(session: SessionPayload): boolean {
  return hasPermission(session, "thanks_redemption:read:all")
}
