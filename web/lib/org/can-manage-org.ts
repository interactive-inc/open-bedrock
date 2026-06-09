const privilegedRoles: ReadonlyArray<string> = ["hr", "admin"]

// 組織図の部署ノードを作成・変更・削除できるロールかを判定する（api の canManageOrg と同一基準）。
export function canManageOrg(role: string): boolean {
  return privilegedRoles.includes(role)
}
