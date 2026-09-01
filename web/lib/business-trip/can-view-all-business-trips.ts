import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 出張申請を全件（他者分含む）閲覧できる権限（business_trip:read:all）を持つか判定する（api の canViewAllBusinessTrips と同一基準）。 */
export function canViewAllBusinessTrips(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("business_trip:read:all")
}
