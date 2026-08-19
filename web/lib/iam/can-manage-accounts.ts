/** System Account を変更できる正規 System permission。 */
export function canManageAccounts(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("system:admin") || permissions.includes("iam:write")
}
