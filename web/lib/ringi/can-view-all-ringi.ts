import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 稟議を全件（他者分含む）閲覧できる権限（ringi:read:all）を持つか判定する（api の canViewAllRingi と同一基準）。 */
export function canViewAllRingi(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("ringi:read:all")
}
