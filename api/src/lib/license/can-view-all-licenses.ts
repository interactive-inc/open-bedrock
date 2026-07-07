import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 全社のライセンス・SaaS 台帳を横断で閲覧できるか判定する。GET /licenses の可否に使う。 */
export function canViewAllLicenses(session: SessionPayload): boolean {
  return hasPermission(session, "license:read:all")
}
