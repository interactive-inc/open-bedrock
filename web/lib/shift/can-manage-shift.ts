const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

// シフトの作成・公開・部署横断検索を行える特権ロールか判定する（api の canManageShift と同一基準）。
export function canManageShift(role: string): boolean {
  return privilegedRoles.includes(role)
}
