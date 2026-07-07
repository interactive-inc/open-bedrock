import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 貸与品予約の状態を代理で進める権限（rental:manage）を持つか判定する純粋関数。 */
export function canManageRentals(session: SessionPayload): boolean {
  return hasPermission(session, "rental:manage")
}
