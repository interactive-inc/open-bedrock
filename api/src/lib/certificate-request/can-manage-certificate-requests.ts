import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 証明書発行依頼の状態を代理で進める権限（certificate_request:manage）を持つか判定する純粋関数。 */
export function canManageCertificateRequests(session: SessionPayload): boolean {
  return hasPermission(session, "certificate_request:manage")
}
