import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 資産の登録・貸出・返却を行える権限を持つか判定する純粋関数。 */
export function canManageAssets(session: SessionPayload): boolean {
  return hasPermission(session, "asset:manage")
}
