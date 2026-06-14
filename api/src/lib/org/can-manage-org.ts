const privilegedRoles: ReadonlyArray<string> = ["hr", "admin"]

// 組織図の部署ノードを作成・変更・削除できるロールかを判定する純粋関数。
export function canManageOrg(viewerRole: string): boolean {
  return privilegedRoles.includes(viewerRole)
}
