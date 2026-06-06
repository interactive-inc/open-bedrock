// 当月の贈与原資の残量を算出する純粋関数。
// granted から当月の贈与済み合計を引く。下限は 0（負にしない）。
export function remainingBudgetPoints(props: {
  grantedPoints: number
  grantedThisMonth: number
}): number {
  const remaining = props.grantedPoints - props.grantedThisMonth

  return remaining < 0 ? 0 : remaining
}
