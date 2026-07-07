/** 給与改定記録を閲覧できる権限（salary_revision:read:all）を持つか判定する（api の canViewAllSalaryRevisions と同一基準）。最機微のため self 例外は無い。 */
export function canViewAllSalaryRevisions(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("salary_revision:read:all")
}
