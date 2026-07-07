/** 経営ダッシュボードを閲覧できる権限（management_dashboard:view）を持つか判定する（api と同一基準）。 */
export function canViewManagementDashboard(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("management_dashboard:view")
}
