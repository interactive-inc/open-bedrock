import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 意思決定記録の作成・更新・supersede を行える権限（decision:manage）を持つか判定する（api の canManageDecisions と同一基準）。 */
export function canManageDecisions(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("decision:manage")
}
