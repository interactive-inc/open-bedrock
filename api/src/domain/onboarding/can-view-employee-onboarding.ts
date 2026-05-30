const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

export type Props = {
  viewerRole: string
}

// 他者の入社/退職手続きを閲覧する権限判定。特権ロールのみ許可する純粋関数。
export function canViewEmployeeOnboarding(props: Props): boolean {
  return privilegedRoles.includes(props.viewerRole)
}
