const privilegedRoles: ReadonlyArray<string> = ["hr", "admin"]

// 交換カタログの管理（登録・編集）を行える特権ロールか判定する（api の canManageRewards と同一基準）。
export function canManageRewards(role: string): boolean {
  return privilegedRoles.includes(role)
}
