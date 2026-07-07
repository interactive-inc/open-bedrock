/** ライフイベント届出の状態を代理で進める権限（life_event:manage）を持つか判定する（api の canManageLifeEvents と同一基準）。 */
export function canManageLifeEvents(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("life_event:manage")
}
