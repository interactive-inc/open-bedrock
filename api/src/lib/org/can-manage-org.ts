import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 組織図の部署ノードを作成・変更・削除できる権限を持つか判定する純粋関数。 */
export function canManageOrg(session: SessionPayload): boolean {
  return hasPermission(session, "org:manage")
}
