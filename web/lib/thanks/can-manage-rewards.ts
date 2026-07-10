// api の canManageRewards と同一基準（permission ベース）。
export function canManageRewards(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("thanks_reward:manage")
}
