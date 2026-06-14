const privilegedRoles: ReadonlyArray<string> = ["hr", "admin"]

// 交換申請の承認・却下が可能なロールかを判定する純粋関数。
export function canDecideRedemption(viewerRole: string): boolean {
  return privilegedRoles.includes(viewerRole)
}
