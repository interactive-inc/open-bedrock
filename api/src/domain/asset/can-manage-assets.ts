const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

// 資産の登録・貸出・返却を行えるロールかを判定する純粋関数。
export function canManageAssets(viewerRole: string): boolean {
  return privilegedRoles.includes(viewerRole)
}
