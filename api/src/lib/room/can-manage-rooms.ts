const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

// 会議室マスタの登録・更新・削除を行えるロールかを判定する純粋関数。
export function canManageRooms(viewerRole: string): boolean {
  return privilegedRoles.includes(viewerRole)
}
