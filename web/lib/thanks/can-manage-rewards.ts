/** 交換カタログの管理（登録・編集）を行える権限（thanks_reward:manage）を持つか判定する（api の canManageRewards と同一基準）。 */
export function canManageRewards(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("thanks_reward:manage")
}
