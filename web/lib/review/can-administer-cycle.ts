import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 評価サイクルの管理操作（作成・開閉・結果閲覧）を行える権限（review:administer）を持つか判定する（api の canAdministerCycle と同一基準）。 */
export function canAdministerCycle(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("review:administer")
}
