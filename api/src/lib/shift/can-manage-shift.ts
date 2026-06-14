const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

/** シフトの作成・公開・部署横断検索ができる役割か。 */
export function canManageShift(viewerRole: string): boolean {
  return privilegedRoles.includes(viewerRole)
}
