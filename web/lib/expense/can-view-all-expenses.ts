/** 経費を全件（他者分含む）閲覧できる権限（expense:read:all）を持つか判定する（api の canViewAllExpenses と同一基準）。 */
export function canViewAllExpenses(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("expense:read:all")
}
