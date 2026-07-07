/** 全社の予算枠を横断で閲覧できる権限（budget:read:all）を持つか判定する（api の canViewAllBudgets と同一基準）。 */
export function canViewAllBudgets(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("budget:read:all")
}
