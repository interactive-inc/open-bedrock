import { Badge } from "@/components/ui/badge"
import type { ExpenseStatus } from "@/lib/api/types/expense-types"

type Props = {
  status: ExpenseStatus
}

/** 経費ステータスを日本語ラベルと配色付きの Badge で表示する。 */
export function ExpenseStatusBadge(props: Props) {
  if (props.status === "approved") {
    return <Badge>承認済み</Badge>
  }

  if (props.status === "settled") {
    return <Badge>精算済み</Badge>
  }

  if (props.status === "rejected") {
    return <Badge variant="destructive">却下</Badge>
  }

  return <Badge variant="secondary">承認待ち</Badge>
}
