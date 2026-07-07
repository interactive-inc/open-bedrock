import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/**
 * 全社の稟議を横断で閲覧できるか判定する。GET /ringi/admin の可否に使う。
 * 決裁可否（指名された承認者本人か）とは別軸で、横断監査を担うロールに付与する
 * `ringi:read:all` を見る（admin / auditor / executive）。
 */
export function canViewAllRingi(session: SessionPayload): boolean {
  return hasPermission(session, "ringi:read:all")
}
