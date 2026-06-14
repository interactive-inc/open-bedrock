const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

// サイクルの管理操作（作成・開閉・結果閲覧）が許される役割かを判定する純粋関数。
export function canAdministerCycle(viewerRole: string): boolean {
  return privilegedRoles.includes(viewerRole)
}
