import { StatusLabel } from "@/components/status-label"
import type { RingiStatus } from "@/lib/api/types/ringi-types"

type Props = { status: RingiStatus }

/** 稟議の承認と決裁確定を区別して表示する。 */
export function RingiStatusBadge(props: Props) {
  if (props.status === "approved") return <StatusLabel>決裁済み</StatusLabel>
  if (props.status === "rejected") return <StatusLabel variant="destructive">却下</StatusLabel>
  if (props.status === "returned") return <StatusLabel>差戻し</StatusLabel>
  if (props.status === "cancelled") return <StatusLabel>取消済み</StatusLabel>
  if (props.status === "awaiting_execution") return <StatusLabel>決裁の確定待ち</StatusLabel>
  return <StatusLabel>承認待ち</StatusLabel>
}
