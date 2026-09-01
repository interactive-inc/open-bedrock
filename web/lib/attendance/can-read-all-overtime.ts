import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 全社の時間外集計を閲覧できる権限（attendance:read:all）を持つか判定する。 */
export function canReadAllOvertime(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("attendance:read:all")
}
