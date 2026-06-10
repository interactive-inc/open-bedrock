const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

// 申請の承認・却下を行えるロールかを判定する（api の canDecideApplication と同一基準）。
export function canDecideApplication(role: string): boolean {
  return privilegedRoles.includes(role)
}
