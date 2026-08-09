import type { Session } from "@/domain/company/iam/session"

export type Props = {
  enrollmentEmployeeId: number
  viewerEmployeeId: number
  session: Session
}

/** 本人、または管理権限を持つ者だけが受講を完了にできる。 */
export function canCompleteEnrollment(props: Props): boolean {
  if (props.enrollmentEmployeeId === props.viewerEmployeeId) {
    return true
  }

  return props.session.hasPermission("training:manage")
}
