import { Button } from "@/components/ui/button"
import type { ExpenseStatus } from "@/lib/api/types/expense-types"

type Props = {
  status: ExpenseStatus
}

/** 経費ステータスを日本語ラベルと配色付きの Button で表示する。 */
export function ExpenseStatusBadge(props: Props) {
  if (props.status === "approved") {
    return (
      <Button type="button" variant="secondary" size="sm">
        承認済み
      </Button>
    )
  }

  if (props.status === "settled") {
    return (
      <Button type="button" variant="secondary" size="sm">
        精算済み
      </Button>
    )
  }

  if (props.status === "rejected") {
    return (
      <Button type="button" variant="destructive" size="sm">
        却下
      </Button>
    )
  }

  return (
    <Button type="button" variant="secondary" size="sm">
      承認待ち
    </Button>
  )
}
