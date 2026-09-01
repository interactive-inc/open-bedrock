import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 配下の時間外集計を閲覧できる権限（attendance:read:reports）を持つか判定する。 */
export function canReadReportsOvertime(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("attendance:read:reports")
}
