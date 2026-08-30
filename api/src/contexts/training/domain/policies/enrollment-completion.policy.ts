import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"

export type Props = {
  enrollmentEmployeeId: EmployeeId
  viewerEmployeeId: EmployeeId
  session: CompanySessionValue
}

/** 本人、または管理権限を持つ者だけが受講を完了にできる。 */
export function canCompleteEnrollment(props: Props): boolean {
  if (props.enrollmentEmployeeId === props.viewerEmployeeId) {
    return true
  }

  return props.session.hasPermission("training:manage")
}
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
