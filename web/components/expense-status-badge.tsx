import { StatusLabel } from "@/components/status-label"
import type { ExpenseStatus } from "@/lib/api/types/expense-types"

type Props = {
  status: ExpenseStatus
}

/** 経費ステータスを日本語ラベルの StatusLabel で表示する。却下・失敗だけ destructive にし、他は secondary に揃える。 */
export function ExpenseStatusBadge(props: Props) {
  if (props.status === "approved") {
    return <StatusLabel>承認済み</StatusLabel>
  }

  if (props.status === "settled") {
    return <StatusLabel>精算済み</StatusLabel>
  }

  if (props.status === "rejected") {
    return <StatusLabel variant="destructive">却下</StatusLabel>
  }

  return <StatusLabel>承認待ち</StatusLabel>
}
