const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

// 社内公募の作成・変更・削除を行える管理ロールか判定する（api の canManageCareerPostings と同一基準）。
export function canManageCareerPostings(role: string): boolean {
  return privilegedRoles.includes(role)
}
