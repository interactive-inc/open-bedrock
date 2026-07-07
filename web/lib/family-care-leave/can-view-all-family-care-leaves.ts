/** 産休・育休・介護休業の申出を全件（他者分含む）閲覧できる権限（family_care_leave:read:all）を持つか判定する（api の canViewAllFamilyCareLeaves と同一基準）。 */
export function canViewAllFamilyCareLeaves(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("family_care_leave:read:all")
}
