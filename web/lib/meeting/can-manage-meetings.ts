/** 会議体マスタの登録・更新・アーカイブを行える権限（meeting:manage）を持つか判定する（api の canManageMeetings と同一基準）。 */
export function canManageMeetings(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("meeting:manage")
}
