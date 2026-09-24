import { StatusLabel } from "@/components/status-label"
import type { ExpenseStatus } from "@/lib/api/types/expense-types"

type Props = {
  status: ExpenseStatus
}

/** 経費ステータスを日本語ラベルの StatusLabel で表示する。却下・失効だけ destructive にし、他は secondary に揃える。 */
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

  if (props.status === "returned") return <StatusLabel>差戻し</StatusLabel>
  if (props.status === "cancelled") return <StatusLabel>取消済み</StatusLabel>
  if (props.status === "awaiting_execution") return <StatusLabel>決裁確定待ち</StatusLabel>
  return <StatusLabel>承認待ち</StatusLabel>
}
