import { Badge } from "@/components/ui/badge"

type Props = {
  status: string
}

// 申請ステータスを日本語ラベルと配色付きの Badge で表示する。
export function ApplicationStatusBadge(props: Props) {
  if (props.status === "approved") {
    return <Badge className="bg-emerald-600 text-white">承認済み</Badge>
  }

  if (props.status === "rejected") {
    return <Badge variant="destructive">却下</Badge>
  }

  return <Badge variant="secondary">承認待ち</Badge>
}
