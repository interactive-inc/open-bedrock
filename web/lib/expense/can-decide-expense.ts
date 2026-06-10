const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

// 経費の承認・却下を行えるロールかを判定する純粋関数（api の canDecideExpense と同一基準）。
export function canDecideExpense(role: string): boolean {
  return privilegedRoles.includes(role)
}
