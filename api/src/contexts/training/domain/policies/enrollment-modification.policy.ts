import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"

export type Props = {
  enrollmentEmployeeId: EmployeeId
  viewerEmployeeId: EmployeeId
  session: CompanySessionValue
}

/** 本人、または研修管理権限を持つ者だけが受講の閲覧・変更・取消を行える。 */
export function canModifyEnrollment(props: Props): boolean {
  if (props.enrollmentEmployeeId === props.viewerEmployeeId) {
    return true
  }

  return props.session.hasPermission("training:manage")
}
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
