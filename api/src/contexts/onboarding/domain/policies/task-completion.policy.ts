import type { Session } from "@/lib/auth/session"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export type Props = {
  taskEmployeeId: EmployeeId
  session: Session
}

/** タスク完了の権限判定。本人か onboarding:manage 権限を持つ場合のみ許可する純粋関数。 */
export function canCompleteTask(props: Props): boolean {
  const isOwner = props.taskEmployeeId === props.session.employeeId

  if (isOwner) {
    return true
  }

  return props.session.hasPermission("onboarding:manage")
}
