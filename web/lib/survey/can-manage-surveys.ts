const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

// アンケートの作成・変更・削除を行える権限を持つか（api の canManageSurveys と同一基準）。
export function canManageSurveys(role: string): boolean {
  return privilegedRoles.includes(role)
}
