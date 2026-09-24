import { StatusLabel } from "@/components/status-label"
import type { LeaveStatus } from "@/lib/api/types/leave-types"

type Props = {
  status: LeaveStatus
}

/** 休暇申請ステータスを日本語ラベルの StatusLabel で表示する。却下・失敗だけ destructive にし、他は secondary に揃える。 */
export function LeaveStatusBadge(props: Props) {
  if (props.status === "approved") {
    return <StatusLabel>承認済み</StatusLabel>
  }

  if (props.status === "rejected") {
    return <StatusLabel variant="destructive">却下</StatusLabel>
  }

  return <StatusLabel>承認待ち</StatusLabel>
}
