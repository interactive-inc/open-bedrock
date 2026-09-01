import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 取引先の登録・更新・アーカイブを行える権限（partner:manage）を持つか判定する（api の canManagePartners と同一基準）。 */
export function canManagePartners(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("partner:manage")
}
