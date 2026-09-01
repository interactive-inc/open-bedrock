import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 全社目標を作成できる権限（review:administer）を持つか判定する（api と同一基準）。 */
export function canWriteCompanyGoal(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("review:administer")
}
