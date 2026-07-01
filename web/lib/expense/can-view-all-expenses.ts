// api の canViewAllExpenses と同一基準（permission ベース）。
export function canViewAllExpenses(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("expense:read:all")
}
