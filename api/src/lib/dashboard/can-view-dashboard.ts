const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

/** ダッシュボードの全社集計を閲覧できる役割か。 */
export function canViewDashboard(viewerRole: string): boolean {
  return privilegedRoles.includes(viewerRole)
}
