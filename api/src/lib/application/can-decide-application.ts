const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

/** 申請の承認・却下、および承認待ち・他者申請の閲覧を行えるロールかを判定する純粋関数。 */
export function canDecideApplication(viewerRole: string): boolean {
  return privilegedRoles.includes(viewerRole)
}
