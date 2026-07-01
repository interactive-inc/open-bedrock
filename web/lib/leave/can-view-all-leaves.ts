// api の canViewAllLeaves と同一基準（permission ベース）。
export function canViewAllLeaves(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("leave:read:all")
}
