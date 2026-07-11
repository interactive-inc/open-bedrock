// api の canManageApplicationTemplates と同一基準（permission ベース）。
export function canManageApplicationTemplates(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("application_template:manage")
}
