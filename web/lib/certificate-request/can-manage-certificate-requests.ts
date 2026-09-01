import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 証明書発行依頼の状態を代理で進める権限（certificate_request:manage）を持つか判定する（api の canManageCertificateRequests と同一基準）。 */
export function canManageCertificateRequests(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("certificate_request:manage")
}
