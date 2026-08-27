import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export type Props = {
  reviewerEmployeeId: EmployeeId
  viewerEmployeeId: EmployeeId
}

/** フォームの提出が、割り当てられた本人によるものかを判定する純粋関数。 */
export function canSubmitForm(props: Props): boolean {
  return props.reviewerEmployeeId === props.viewerEmployeeId
}
