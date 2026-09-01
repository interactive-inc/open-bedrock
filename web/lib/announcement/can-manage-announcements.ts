import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 社内アナウンスの作成・公開・アーカイブを行える権限（announcement:manage）を持つか判定する（api の canManageAnnouncements と同一基準）。 */
export function canManageAnnouncements(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("announcement:manage")
}
