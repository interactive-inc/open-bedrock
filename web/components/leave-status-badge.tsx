import { Badge } from "@/components/ui/badge"
import type { LeaveStatus } from "@/lib/api/types/leave-types"

type Props = {
  status: LeaveStatus
}

/** 休暇申請ステータスを日本語ラベルと配色付きの Badge で表示する。 */
export function LeaveStatusBadge(props: Props) {
  if (props.status === "approved") {
    return <Badge className="bg-emerald-600 text-white">承認済み</Badge>
  }

  if (props.status === "rejected") {
    return <Badge variant="destructive">却下</Badge>
  }

  return <Badge variant="secondary">承認待ち</Badge>
}
