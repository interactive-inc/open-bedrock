const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

// 休暇申請の承認・却下を行えるロールかを判定する純粋関数（api の canDecideLeave と同一基準）。
export function canDecideLeave(role: string): boolean {
  return privilegedRoles.includes(role)
}
