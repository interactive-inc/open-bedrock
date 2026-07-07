import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 会議体マスタの登録・更新・アーカイブを行える権限を持つか判定する純粋関数。 */
export function canManageMeetings(session: SessionPayload): boolean {
  return hasPermission(session, "meeting:manage")
}
