import { Badge } from "@/components/ui/badge"

type Props = {
  status: string
}

/** 物品の在庫状態を日本語ラベルと配色付きの Badge で表示する。 */
export function AssetStatusBadge(props: Props) {
  if (props.status === "lent") {
    return <Badge>貸与中</Badge>
  }

  if (props.status === "in_stock") {
    return <Badge>在庫</Badge>
  }

  if (props.status === "disposed") {
    return <Badge variant="secondary">廃棄済み</Badge>
  }

  return <Badge variant="secondary">{props.status}</Badge>
}
