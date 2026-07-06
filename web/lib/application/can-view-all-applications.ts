/** 申請を全件（他者分含む）閲覧できる権限（application:read:all）を持つか判定する（api の canViewAllApplications と同一基準）。 */
export function canViewAllApplications(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("application:read:all")
}
