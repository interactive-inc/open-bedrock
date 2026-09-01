import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 給与改定の事実記録を登録できる権限（salary_revision:manage）を持つか判定する（api の canManageSalaryRevisions と同一基準）。最機微。 */
export function canManageSalaryRevisions(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("salary_revision:manage")
}
