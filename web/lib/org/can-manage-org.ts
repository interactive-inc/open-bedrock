// api の canManageOrg と同一基準（permission ベース）。
export function canManageOrg(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("org:manage")
}
