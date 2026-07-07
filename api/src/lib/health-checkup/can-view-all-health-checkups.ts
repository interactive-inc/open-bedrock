import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/**
 * 本人以外の健診実施記録を横断で閲覧できるか判定する（health_checkup:read:all）。
 * 健診は要配慮情報のため hr / admin のみ。監査ロールにも見せない。
 */
export function canViewAllHealthCheckups(session: SessionPayload): boolean {
  return hasPermission(session, "health_checkup:read:all")
}
