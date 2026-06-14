const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

/** 申請テンプレートの作成・変更・削除を行えるロールかを判定する純粋関数。 */
export function canManageApplicationTemplates(viewerRole: string): boolean {
  return privilegedRoles.includes(viewerRole)
}
