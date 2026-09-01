import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 研修コースの作成や他者への割り当てを行える権限（training:manage）を持つか判定する（api の canManageTraining と同一基準）。 */
export function canManageTraining(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("training:manage")
}
