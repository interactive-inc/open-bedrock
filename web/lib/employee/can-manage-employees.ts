// 従業員台帳の登録・更新・削除を行える権限を持つかを判定する（api の canManageEmployees と同一基準）。
export function canManageEmployees(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("employee:create")
}
