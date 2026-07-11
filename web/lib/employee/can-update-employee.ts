// api の canUpdateEmployee と同一基準（permission ベース）。
export function canUpdateEmployee(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("employee:update")
}
