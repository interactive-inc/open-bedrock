/** 健診・ストレスチェックの実施記録を登録／完了できる権限（health_checkup:manage）を持つか判定する（api の canManageHealthCheckups と同一基準）。 */
export function canManageHealthCheckups(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("health_checkup:manage")
}
