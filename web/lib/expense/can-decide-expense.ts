import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 経費の承認・却下を行える権限（expense:approve）を持つか判定する（api の canDecideExpense と同一基準）。 */
export function canDecideExpense(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("expense:approve")
}
