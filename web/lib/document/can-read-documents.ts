import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 文書台帳を閲覧できる権限（document:read:all）を持つか判定する（api の canReadDocuments と同一基準）。 */
export function canReadDocuments(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("document:read:all")
}
