const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

// 従業員台帳の登録・更新・削除を行えるロールかを判定する純粋関数。
export function canManageEmployees(viewerRole: string): boolean {
  return privilegedRoles.includes(viewerRole)
}
