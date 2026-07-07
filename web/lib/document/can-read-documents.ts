/** 文書台帳を閲覧できる権限（document:read:all）を持つか判定する（api の canReadDocuments と同一基準）。 */
export function canReadDocuments(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("document:read:all")
}
