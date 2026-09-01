import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 採用（募集・応募者）を扱える権限（recruitment:manage）を持つか判定する（api の canManageRecruitment と同一基準）。 */
export function canManageRecruitment(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("recruitment:manage")
}
