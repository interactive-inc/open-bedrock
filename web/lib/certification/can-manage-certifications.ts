/** 資格マスタ・保有記録を登録／更新／削除できる権限（certification:manage）を持つか判定する（api の canManageCertifications と同一基準）。 */
export function canManageCertifications(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("certification:manage")
}
