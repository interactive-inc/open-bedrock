const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

// 申請テンプレートの作成・変更・削除を行える特権ロールか判定する（api の canManageApplicationTemplates と同一基準）。
export function canManageApplicationTemplates(role: string): boolean {
  return privilegedRoles.includes(role)
}
