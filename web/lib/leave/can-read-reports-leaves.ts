/** 配下の休暇申請を閲覧できる権限（leave:read:reports）を持つか判定する。 */
export function canReadReportsLeaves(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("leave:read:reports")
}
