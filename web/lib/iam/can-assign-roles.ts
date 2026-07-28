/** api の canAssignRoles と同一基準（permission ベース）。 */
export function canAssignRoles(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("iam:assign_roles")
}
