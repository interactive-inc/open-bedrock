const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

/** 社内公募の作成・変更・削除を行える管理ロールかを判定する純粋関数。 */
export function canManageCareerPostings(viewerRole: string): boolean {
  return privilegedRoles.includes(viewerRole)
}
