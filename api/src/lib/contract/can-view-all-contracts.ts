import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/**
 * 全社の契約記録を横断で閲覧できるか判定する。GET /contracts の可否に使う。
 * 管理可否とは別軸で、総務 / admin / 監査 / 経営など閲覧を担うロールに付与する
 * `contract:read:all` を見る。
 */
export function canViewAllContracts(session: SessionPayload): boolean {
  return hasPermission(session, "contract:read:all")
}
