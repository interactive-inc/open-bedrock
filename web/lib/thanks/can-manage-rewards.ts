import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 交換カタログの管理（登録・編集）を行える権限（thanks_reward:manage）を持つか判定する（api の canManageRewards と同一基準）。 */
export function canManageRewards(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("thanks_reward:manage")
}
