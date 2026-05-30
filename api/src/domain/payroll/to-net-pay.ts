export type Props = {
  baseSalary: number
  allowances: number
  deductions: number
}

// 基本給に手当を足し控除を引いた差引支給額を求める純粋関数。
export function toNetPay(props: Props): number {
  return props.baseSalary + props.allowances - props.deductions
}
