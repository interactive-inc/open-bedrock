const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

// オンボーディングテンプレートの作成・変更・削除を行える権限を持つか。
export function canManageOnboarding(viewerRole: string): boolean {
  return privilegedRoles.includes(viewerRole)
}
