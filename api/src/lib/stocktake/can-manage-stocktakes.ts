import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 棚卸しの開始・確認・締めを行える権限を持つか判定する純粋関数。資産管理権限を流用する。 */
export function canManageStocktakes(session: SessionPayload): boolean {
  return hasPermission(session, "asset:manage")
}
