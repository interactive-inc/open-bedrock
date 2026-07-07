/** 会社カレンダーを管理できる権限（calendar:manage）を持つか判定する（api の canManageCalendar と同一基準）。 */
export function canManageCalendar(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("calendar:manage")
}
