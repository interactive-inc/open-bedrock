import type { PermissionKey } from "@/lib/api/types/permission-key"

/** ポイント交換申請を全件（他者分含む）閲覧できる権限（thanks_redemption:read:all）を持つか判定する（api の canViewAllRedemptions と同一基準）。 */
export function canViewAllRedemptions(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("thanks_redemption:read:all")
}
