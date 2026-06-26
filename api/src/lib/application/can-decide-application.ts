import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 申請の承認・却下、および承認待ち・他者申請の閲覧を行える権限を持つか判定する純粋関数。 */
export function canDecideApplication(session: SessionPayload): boolean {
  return hasPermission(session, "application:approve")
}
