import type { Session } from "@/domain/company/iam/session"

export type Props = {
  enrollmentEmployeeId: number
  viewerEmployeeId: number
  session: Session
}

/** 本人、または研修管理権限を持つ者だけが受講の閲覧・変更・取消を行える。 */
export function canModifyEnrollment(props: Props): boolean {
  if (props.enrollmentEmployeeId === props.viewerEmployeeId) {
    return true
  }

  return props.session.hasPermission("training:manage")
}
