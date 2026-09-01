import type { PermissionKey } from "@/lib/api/types/permission-key"

/** api の canManageBudgets と同一基準（permission ベース）。 */
export function canManageBudgets(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("budget:manage")
}
