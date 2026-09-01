import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 人員計画を登録・更新できる権限（headcount_plan:manage）を持つか判定する。 */
export function canManageHeadcountPlans(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("headcount_plan:manage")
}
