import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 出張申請の状態を代理で進める権限（business_trip:manage）を持つか判定する（api の canManageBusinessTrips と同一基準）。 */
export function canManageBusinessTrips(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("business_trip:manage")
}
