// api の canManageCareerPostings と同一基準（permission ベース）。
export function canManageCareerPostings(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("career_posting:manage")
}
