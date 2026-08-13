import type { EmployeeRelation } from "@/contexts/company/domain/organization/employee-relation"
import type { MembershipEntry } from "@/contexts/company/domain/organization/is-report-of"
import { isReportOf } from "@/contexts/company/domain/organization/is-report-of"

export type Props = {
  memberships: ReadonlyMap<string, MembershipEntry>
  viewerEmployeeCode: string
  targetEmployeeCode: string
}

/**
 * membership マップと両者のコードから関係を組み立てる純粋関数。
 * membership を持たない従業員との同部署判定は false。
 */
export function toEmployeeRelation(props: Props): EmployeeRelation {
  const isSelf = props.viewerEmployeeCode === props.targetEmployeeCode

  const viewerDepartment = props.memberships.get(props.viewerEmployeeCode)?.departmentCode ?? null

  const targetDepartment = props.memberships.get(props.targetEmployeeCode)?.departmentCode ?? null

  const isSameDepartment =
    viewerDepartment !== null && targetDepartment !== null && viewerDepartment === targetDepartment

  return {
    isSelf,
    isReport: isReportOf({
      memberships: props.memberships,
      targetEmployeeCode: props.targetEmployeeCode,
      viewerEmployeeCode: props.viewerEmployeeCode,
    }),
    isSameDepartment,
  }
}
