import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 配下の休暇申請を閲覧できる権限（leave:read:reports）を持つか判定する。 */
export function canReadReportsLeaves(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("leave:read:reports")
}
