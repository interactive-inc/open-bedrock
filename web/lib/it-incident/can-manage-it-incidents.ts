import type { PermissionKey } from "@/lib/api/types/permission-key"

/** インシデント記録の登録・更新・解消を行える権限（it_incident:manage）を持つか判定する（api の canManageItIncidents と同一基準）。 */
export function canManageItIncidents(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("it_incident:manage")
}
