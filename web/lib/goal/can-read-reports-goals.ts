import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 配下の目標を閲覧できる権限（goal:read:reports）を持つか判定する。 */
export function canReadReportsGoals(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("goal:read:reports")
}
