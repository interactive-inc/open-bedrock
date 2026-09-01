import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 契約記録の登録・更新を行える権限（contract:manage）を持つか判定する（api の canManageContracts と同一基準）。 */
export function canManageContracts(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("contract:manage")
}
