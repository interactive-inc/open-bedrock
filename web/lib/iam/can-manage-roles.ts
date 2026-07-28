/** api の canManageRoles と同一基準（permission ベース）。 */
export function canManageRoles(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("iam:manage_roles")
}
