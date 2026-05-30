import { Badge } from "@/components/ui/badge"

type Props = {
  status: string
}

// 物品の在庫状態を日本語ラベルと配色付きの Badge で表示する。
export function AssetStatusBadge(props: Props) {
  if (props.status === "lent") {
    return <Badge className="bg-amber-600 text-white">貸与中</Badge>
  }

  if (props.status === "in_stock") {
    return <Badge className="bg-emerald-600 text-white">在庫</Badge>
  }

  return <Badge variant="secondary">{props.status}</Badge>
}
