/** 従業員台帳の登録・更新を行える権限（employee:create）を持つか判定する（api の canManageEmployees と同一基準）。 */
export function canManageEmployees(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("employee:create")
}
