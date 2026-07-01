import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/**
 * 全社の経費申請を横断で閲覧できるか判定する。GET /expenses/admin の可否に使う。
 * 承認可否とは別軸で、hr / admin など横断監査を担うロールに付与する `expense:read:all` を見る。
 */
export function canViewAllExpenses(session: SessionPayload): boolean {
  return hasPermission(session, "expense:read:all")
}
