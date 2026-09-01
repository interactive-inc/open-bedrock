import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 表彰の記録を登録・削除できる権限（commendation:manage）を持つか判定する。閲覧は全認証者に開く。 */
export function canManageCommendations(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("commendation:manage")
}
