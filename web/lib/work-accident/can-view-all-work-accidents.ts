import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 労災・事故の発生記録を横断で閲覧できる権限（work_accident:read:all）を持つか判定する（api の canViewAllWorkAccidents と同一基準）。 */
export function canViewAllWorkAccidents(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("work_accident:read:all")
}
