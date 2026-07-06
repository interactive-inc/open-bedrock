/** バッチジョブ一覧を閲覧できる権限（batch:view）を持つか判定する（api の canManageBatch と同一基準）。 */
export function canManageBatch(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("batch:view")
}
