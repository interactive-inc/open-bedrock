import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/**
 * 本人以外の資格保有記録を横断で閲覧できるか判定する（certification:read:all）。
 * hr / admin のほか、資格は監査ロールも閲覧できる。
 */
export function canViewAllCertifications(session: SessionPayload): boolean {
  return hasPermission(session, "certification:read:all")
}
