import type { PermissionKey } from "@/lib/api/types/permission-key"

/** シフト交代申請を全件（他者分含む）閲覧できる権限（shift_swap:read:all）を持つか判定する（api の canViewAllShiftSwaps と同一基準）。 */
export function canViewAllShiftSwaps(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("shift_swap:read:all")
}
