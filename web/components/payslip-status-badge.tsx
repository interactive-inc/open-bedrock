import { Badge } from "@/components/ui/badge"

type Props = {
  status: string
}

// 給与明細ステータスを日本語ラベルと配色付きの Badge で表示する。
export function PayslipStatusBadge(props: Props) {
  if (props.status === "issued") {
    return <Badge className="bg-emerald-600 text-white">発行済み</Badge>
  }

  return <Badge variant="secondary">下書き</Badge>
}
