import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/**
 * 労災・事故の発生記録を横断で閲覧できるか判定する（work_accident:read:all）。
 * hr / admin のほか、労災は監査ロールも閲覧できる。
 */
export function canViewAllWorkAccidents(session: SessionPayload): boolean {
  return hasPermission(session, "work_accident:read:all")
}
