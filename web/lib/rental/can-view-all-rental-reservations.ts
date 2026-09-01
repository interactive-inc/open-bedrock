import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 貸与品予約を全件（他者分含む）閲覧できる権限（rental:read:all）を持つか判定する（api の canViewAllRentalReservations と同一基準）。 */
export function canViewAllRentalReservations(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("rental:read:all")
}
