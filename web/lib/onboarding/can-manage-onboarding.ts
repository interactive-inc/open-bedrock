// api の canManageOnboarding と同一基準（permission ベース）。
export function canManageOnboarding(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("onboarding:manage")
}
