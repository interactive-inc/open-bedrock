import type { SalaryRevision } from "@/domain/payroll/salary-revision"

export type Props = {
  priorRevision: SalaryRevision | null
}

// 直前の改定があればその新基本給を、なければ 0 を前回基本給とする純粋関数。
export function toPreviousBaseSalary(props: Props): number {
  if (props.priorRevision === null) {
    return 0
  }

  return props.priorRevision.newBaseSalary
}
