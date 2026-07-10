// api の canDeleteEmployee と同一基準（permission ベース）。
export function canDeleteEmployee(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("employee:delete")
}
