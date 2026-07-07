import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/**
 * 健診・ストレスチェックの実施記録を登録／完了できる権限（health_checkup:manage）を持つか判定する。
 */
export function canManageHealthCheckups(session: SessionPayload): boolean {
  return hasPermission(session, "health_checkup:manage")
}
