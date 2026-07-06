/** オンボーディングテンプレートの作成・変更・削除を行える権限（onboarding:manage）を持つか判定する（api の canManageOnboarding と同一基準）。 */
export function canManageOnboarding(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("onboarding:manage")
}
