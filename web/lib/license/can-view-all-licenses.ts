/** 全社のライセンス・SaaS 台帳を横断で閲覧できる権限（license:read:all）を持つか判定する（api の canViewAllLicenses と同一基準）。 */
export function canViewAllLicenses(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("license:read:all")
}
