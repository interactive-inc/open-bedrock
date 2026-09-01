import type { PermissionKey } from "@/lib/api/types/permission-key"

/** ライフイベント届を全件（他者分含む）閲覧できる権限（life_event:read:all）を持つか判定する（api の canViewAllLifeEvents と同一基準）。 */
export function canViewAllLifeEvents(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("life_event:read:all")
}
