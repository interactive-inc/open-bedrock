const privilegedRoles: ReadonlyArray<string> = ["hr", "admin"]

// 交換カタログの管理（登録・更新・無効化）が可能なロールかを判定する純粋関数。
// 既存の経費承認の role gate（manager / hr / admin）に倣いつつ、カタログ管理は hr / admin に限定する。
export function canManageRewards(viewerRole: string): boolean {
  return privilegedRoles.includes(viewerRole)
}
