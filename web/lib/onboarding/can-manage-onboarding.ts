const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

// オンボーディングテンプレートの作成・変更・削除を行える権限を持つか（api の canManageOnboarding と同一基準）。
export function canManageOnboarding(role: string): boolean {
  return privilegedRoles.includes(role)
}
