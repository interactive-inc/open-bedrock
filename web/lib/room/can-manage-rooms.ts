const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

// 会議室マスタの登録・更新・削除を行えるロールかを判定する（api の canManageRooms と同一基準）。
export function canManageRooms(role: string): boolean {
  return privilegedRoles.includes(role)
}
