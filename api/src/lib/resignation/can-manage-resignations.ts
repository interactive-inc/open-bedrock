import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 退職申請の状態を代理で進める権限（resignation:manage）を持つか判定する純粋関数。 */
export function canManageResignations(session: SessionPayload): boolean {
  return hasPermission(session, "resignation:manage")
}
