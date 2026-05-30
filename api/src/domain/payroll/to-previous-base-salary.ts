import type { SalaryRevision } from "@/domain/payroll/salary-revision"

export type Props = {
  latestRevision: SalaryRevision | null
}

// 直近の改定があればその新基本給を、なければ 0 を前回基本給とする純粋関数。
export function toPreviousBaseSalary(props: Props): number {
  if (props.latestRevision === null) {
    return 0
  }

  return props.latestRevision.newBaseSalary
}
