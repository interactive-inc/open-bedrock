import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 人員計画を閲覧できる権限（headcount_plan:read:all）を持つか判定する。 */
export function canReadHeadcountPlans(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("headcount_plan:read:all")
}
