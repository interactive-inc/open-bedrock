/** 契約記録を全件（横断）閲覧できる権限（contract:read:all）を持つか判定する（api の canViewAllContracts と同一基準）。 */
export function canViewAllContracts(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("contract:read:all")
}
