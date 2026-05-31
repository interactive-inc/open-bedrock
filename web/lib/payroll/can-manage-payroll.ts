const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

// 給与の発行・改定・横断閲覧を行える特権ロールか判定する（api の canManagePayroll と同一基準）。
export function canManagePayroll(role: string): boolean {
  return privilegedRoles.includes(role)
}
