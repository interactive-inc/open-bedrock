import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** ライセンス・SaaS 台帳の登録・更新・解約を行える権限を持つか判定する。 */
export function canManageLicenses(session: SessionPayload): boolean {
  return hasPermission(session, "license:manage")
}
