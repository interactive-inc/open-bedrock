const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

// 経費の承認・却下が可能なロールかどうかを判定する純粋関数。
export function canDecideExpense(viewerRole: string): boolean {
  return privilegedRoles.includes(viewerRole)
}
