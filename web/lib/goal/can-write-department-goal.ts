/**
 * 部門目標を作成できる可能性がある権限を持つか判定する（フォーム出し分け用の緩い判定）。
 * review:administer は全部門、goal:evaluate:reports は自部門のみ。厳密な部門一致は api が判定する。
 */
export function canWriteDepartmentGoal(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("review:administer") || permissions.includes("goal:evaluate:reports")
}
