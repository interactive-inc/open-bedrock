// api の canDecideExpense と同一基準（permission ベース）。
export function canDecideExpense(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("expense:approve")
}
