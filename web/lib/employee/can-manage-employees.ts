const privilegedRoles: ReadonlyArray<string> = ["hr", "admin"]

// 従業員台帳の登録・更新・削除を行えるロールかを判定する（api の canManageEmployees と同一基準）。
export function canManageEmployees(role: string): boolean {
  return privilegedRoles.includes(role)
}
