/**
 * 上司関係グラフ（社員コード基準）を辿り、actor が target の管理系列にいるか判定する。
 */
export function isInManagementChain(props: {
  actorCode: string
  targetCode: string
  managersByEmployee: ReadonlyMap<string, ReadonlySet<string>>
}): boolean {
  const pending = [...(props.managersByEmployee.get(props.targetCode) ?? [])]
  const visited = new Set<string>([props.targetCode])

  while (pending.length > 0) {
    const managerCode = pending.shift()

    if (managerCode === undefined || visited.has(managerCode)) {
      continue
    }

    if (managerCode === props.actorCode) {
      return true
    }

    visited.add(managerCode)
    pending.push(...(props.managersByEmployee.get(managerCode) ?? []))
  }

  return false
}
