// api の canManageAssets と同一基準（permission ベース）。
export function canManageAssets(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("asset:manage")
}
