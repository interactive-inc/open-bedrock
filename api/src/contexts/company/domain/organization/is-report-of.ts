export type MembershipEntry = {
  departmentCode: string
  managerEmployeeCode: string | null
}

export type Props = {
  memberships: ReadonlyMap<string, MembershipEntry>
  targetEmployeeCode: string
  viewerEmployeeCode: string
}

/**
 * target のマネージャーチェーンを上に辿り、viewer が現れるか判定する純粋関数。
 * 直属に限らず配下全体を対象にする。循環は visited で防ぐ。
 */
export function isReportOf(props: Props): boolean {
  const visited = new Set<string>()

  let currentCode = props.memberships.get(props.targetEmployeeCode)?.managerEmployeeCode ?? null

  while (currentCode !== null && visited.has(currentCode) === false) {
    if (currentCode === props.viewerEmployeeCode) {
      return true
    }

    visited.add(currentCode)

    currentCode = props.memberships.get(currentCode)?.managerEmployeeCode ?? null
  }

  return false
}
