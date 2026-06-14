const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

export type Props = {
  taskEmployeeId: number
  viewerEmployeeId: number
  viewerRole: string
}

/** タスク完了の権限判定。本人か特権ロールのみ許可する純粋関数。 */
export function canCompleteTask(props: Props): boolean {
  const isOwner = props.taskEmployeeId === props.viewerEmployeeId

  if (isOwner) {
    return true
  }

  return privilegedRoles.includes(props.viewerRole)
}
