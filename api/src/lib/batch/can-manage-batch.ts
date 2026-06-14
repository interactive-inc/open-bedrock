const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

/** バッチジョブ一覧の閲覧ができる役割か。 */
export function canManageBatch(viewerRole: string): boolean {
  return privilegedRoles.includes(viewerRole)
}
