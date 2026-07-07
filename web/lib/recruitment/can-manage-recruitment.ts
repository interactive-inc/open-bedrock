/** 採用（募集・応募者）を扱える権限（recruitment:manage）を持つか判定する（api の canManageRecruitment と同一基準）。 */
export function canManageRecruitment(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("recruitment:manage")
}
