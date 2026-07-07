/** 取引先の登録・更新・アーカイブを行える権限（partner:manage）を持つか判定する（api の canManagePartners と同一基準）。 */
export function canManagePartners(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("partner:manage")
}
