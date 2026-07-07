import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/**
 * 全社の証明書発行依頼を横断で閲覧できるか判定する。GET /certificate-requests/admin の可否に使う。
 * hr / admin / auditor など横断監査を担うロールに付与する `certificate_request:read:all` を見る。
 */
export function canViewAllCertificateRequests(session: SessionPayload): boolean {
  return hasPermission(session, "certificate_request:read:all")
}
