import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 反社チェックの判定結果（result）を設定・変更できる権限を持つか判定する純粋関数。 */
export function canManageAntisocialChecks(session: SessionPayload): boolean {
  return hasPermission(session, "antisocial_check:manage")
}
