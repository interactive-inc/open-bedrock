import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 会議室マスタの登録・更新・削除を行える権限を持つか判定する純粋関数。 */
export function canManageRooms(session: SessionPayload): boolean {
  return hasPermission(session, "room:manage")
}
