const privilegedRoles: ReadonlyArray<string> = ["hr", "admin"]

/**
 * 従業員台帳からの削除を行えるロールかを判定する純粋関数。
 * 削除は不可逆かつ 43 件のカスケード DELETE を伴うため、hr/admin に限定する。
 */
export function canDeleteEmployee(viewerRole: string): boolean {
  return privilegedRoles.includes(viewerRole)
}
