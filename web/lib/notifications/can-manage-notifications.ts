// api の canSendNotification と同一基準（permission ベース）。
export function canManageNotifications(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("notification:send")
}
