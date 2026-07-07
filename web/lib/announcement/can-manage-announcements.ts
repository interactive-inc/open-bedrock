/** 社内アナウンスの作成・公開・アーカイブを行える権限（announcement:manage）を持つか判定する（api の canManageAnnouncements と同一基準）。 */
export function canManageAnnouncements(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("announcement:manage")
}
