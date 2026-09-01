import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 休暇申請を全件（他者分含む）閲覧できる権限（leave:read:all）を持つか判定する（api の canViewAllLeaves と同一基準）。 */
export function canViewAllLeaves(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("leave:read:all")
}
