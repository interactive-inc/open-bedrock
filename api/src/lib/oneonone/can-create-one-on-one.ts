const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

/** 1on1 を記録できる（マネージャー以上の）ロールかどうかを判定する純粋関数。 */
export function canCreateOneOnOne(viewerRole: string): boolean {
  return privilegedRoles.includes(viewerRole)
}
