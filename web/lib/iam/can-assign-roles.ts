/** System Role Binding を変更できる正規 System permission。 */
export function canAssignRoles(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("system:admin") || permissions.includes("iam:write")
}
