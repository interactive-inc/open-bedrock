// 評価サイクルの管理操作（作成・開閉・結果閲覧）を行える特権ロールか判定する
// （api の canAdministerCycle と同一基準、permission ベース）。
export function canAdministerCycle(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("review:administer")
}
