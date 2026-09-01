import type { PermissionKey } from "@/lib/api/types/permission-key"

/** シフトの作成・公開・部署横断検索を行える権限（shift:manage）を持つか判定する（api の canManageShift と同一基準）。 */
export function canManageShift(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("shift:manage")
}
