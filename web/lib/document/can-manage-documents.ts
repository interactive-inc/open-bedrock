import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 文書台帳の登録・更新を行える権限（document:manage）を持つか判定する（api の canManageDocuments と同一基準）。 */
export function canManageDocuments(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("document:manage")
}
