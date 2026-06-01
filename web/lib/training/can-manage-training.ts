const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

// 研修コースの作成や他者への割り当てを行える特権ロールか判定する（api の canManageTraining と同一基準）。
export function canManageTraining(role: string): boolean {
  return privilegedRoles.includes(role)
}
