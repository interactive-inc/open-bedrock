const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

// シフト交代の承認を行える特権ロールか判定する（api の canApproveShiftSwap と同一基準）。
export function canApproveShiftSwap(role: string): boolean {
  return privilegedRoles.includes(role)
}
