import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 貸与品予約の状態を代理で進める権限（rental:manage）を持つか判定する（api の canManageRentals と同一基準）。 */
export function canManageRentals(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("rental:manage")
}
