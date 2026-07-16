export function canArchiveEmployee(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("employee:archive")
}
