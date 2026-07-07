/** 退職手続きを全件（他者分含む）閲覧できる権限（resignation:read:all）を持つか判定する（api の canViewAllResignations と同一基準）。 */
export function canViewAllResignations(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("resignation:read:all")
}
