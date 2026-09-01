import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 資産の登録・更新・削除・貸出・返却を行える権限（asset:manage）を持つか判定する（api の canManageAssets と同一基準）。 */
export function canManageAssets(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("asset:manage")
}
