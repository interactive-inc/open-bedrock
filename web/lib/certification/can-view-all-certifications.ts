/** 本人以外の資格保有記録を横断で閲覧できる権限（certification:read:all）を持つか判定する（api の canViewAllCertifications と同一基準）。 */
export function canViewAllCertifications(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("certification:read:all")
}
