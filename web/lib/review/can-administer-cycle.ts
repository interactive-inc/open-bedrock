const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

// 評価サイクルの管理操作（作成・開閉・結果閲覧）を行える特権ロールか判定する
// （api の canAdministerCycle と同一基準）。
export function canAdministerCycle(role: string): boolean {
  return privilegedRoles.includes(role)
}
