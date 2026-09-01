import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 本人以外の健診実施記録を横断で閲覧できる権限（health_checkup:read:all）を持つか判定する（api の canViewAllHealthCheckups と同一基準）。健診は要配慮情報のため hr / admin のみ。 */
export function canViewAllHealthCheckups(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("health_checkup:read:all")
}
