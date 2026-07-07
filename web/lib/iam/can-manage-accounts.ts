// api の canManageAccounts と同一基準（permission ベース）。
export function canManageAccounts(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("account:manage")
}
