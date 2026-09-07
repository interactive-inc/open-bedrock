import { Badge } from "@/components/ui/badge"
import type { RingiStatus } from "@/lib/api/types/ringi-types"

type Props = { status: RingiStatus }

/** 稟議の承認と決裁確定を区別して表示する。 */
export function RingiStatusBadge(props: Props) {
  if (props.status === "approved") return <Badge>決裁済み</Badge>
  if (props.status === "rejected") return <Badge variant="destructive">却下</Badge>
  if (props.status === "returned") return <Badge variant="outline">差戻し</Badge>
  if (props.status === "cancelled") return <Badge variant="outline">取消済み</Badge>
  if (props.status === "awaiting_execution") return <Badge variant="outline">決裁の確定待ち</Badge>
  return <Badge variant="secondary">承認待ち</Badge>
}
