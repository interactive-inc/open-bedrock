// api の canManageSurveys と同一基準（permission ベース）。
export function canManageSurveys(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("survey:manage")
}
