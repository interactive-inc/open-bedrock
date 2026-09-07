import { Button } from "@/components/ui/button"
import type { LeaveStatus } from "@/lib/api/types/leave-types"

type Props = {
  status: LeaveStatus
}

/** 休暇申請ステータスを日本語ラベルと配色付きの Button で表示する。 */
export function LeaveStatusBadge(props: Props) {
  if (props.status === "approved") {
    return (
      <Button type="button" variant="secondary" size="sm">
        承認済み
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
