import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/**
 * 全社のシフト交代申請を横断で閲覧できるか判定する。GET /shift/swap-requests/admin の可否に使う。
 * hr / admin など横断監査を担うロールに付与する `shift_swap:read:all` を見る。
 */
export function canViewAllShiftSwaps(session: SessionPayload): boolean {
  return hasPermission(session, "shift_swap:read:all")
}
