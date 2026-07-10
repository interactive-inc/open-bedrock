// api の canCreateEmployee と同一基準（permission ベース）。
export function canCreateEmployee(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("employee:create")
}
