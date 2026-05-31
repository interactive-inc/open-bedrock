const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

// 通知の作成を行える特権ロールか判定する（api の canSendNotification と同一基準）。
export function canManageNotifications(role: string): boolean {
  return privilegedRoles.includes(role)
}
