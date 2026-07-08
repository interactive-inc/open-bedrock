// api の canManageBudgets と同一基準（permission ベース）。
export function canManageBudgets(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("budget:manage")
}
