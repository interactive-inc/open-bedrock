const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

/** 反社チェックの判定結果（result）を設定・変更できるロールかを判定する純粋関数。 */
export function canManageAntisocialChecks(viewerRole: string): boolean {
  return privilegedRoles.includes(viewerRole)
}
