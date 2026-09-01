import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 規程集の新規登録・新版追加・アーカイブを行える権限（regulation:manage）を持つか判定する（api の canManageRegulations と同一基準）。 */
export function canManageRegulations(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("regulation:manage")
}
