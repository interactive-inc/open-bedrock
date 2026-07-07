import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/**
 * 全社の貸与品予約を横断で閲覧できるか判定する。GET /rentals/admin の可否に使う。
 * hr / admin / auditor / general_affairs など横断監査を担うロールに付与する `rental:read:all` を見る。
 */
export function canViewAllRentalReservations(session: SessionPayload): boolean {
  return hasPermission(session, "rental:read:all")
}
