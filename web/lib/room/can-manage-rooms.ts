import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 会議室マスタの登録・更新・削除を行える権限（room:manage）を持つか判定する（api の canManageRooms と同一基準）。 */
export function canManageRooms(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("room:manage")
}
