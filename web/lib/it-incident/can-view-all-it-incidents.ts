import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 全社のインシデント記録を横断で閲覧できる権限（it_incident:read:all）を持つか判定する（api の canViewAllItIncidents と同一基準）。 */
export function canViewAllItIncidents(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("it_incident:read:all")
}
