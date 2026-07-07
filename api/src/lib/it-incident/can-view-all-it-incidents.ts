import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 全社のインシデント記録を横断で閲覧できるか判定する。GET /it-incidents の可否に使う。 */
export function canViewAllItIncidents(session: SessionPayload): boolean {
  return hasPermission(session, "it_incident:read:all")
}
