const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

// 資産の登録・変更・削除・貸出・返却を行えるロールかを判定する純粋関数（api の canManageAssets と同一基準）。
export function canManageAssets(role: string): boolean {
  return privilegedRoles.includes(role)
}
