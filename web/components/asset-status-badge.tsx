import { StatusLabel } from "@/components/status-label"

type Props = {
  status: string
}

/** 物品の在庫状態を日本語ラベルの StatusLabel で表示する。却下・失敗だけ destructive にし、他は secondary に揃える。 */
export function AssetStatusBadge(props: Props) {
  if (props.status === "lent") {
    return <StatusLabel>貸与中</StatusLabel>
  }

  if (props.status === "in_stock") {
    return <StatusLabel>在庫</StatusLabel>
  }

  if (props.status === "disposed") {
    return <StatusLabel>廃棄済み</StatusLabel>
  }

  return <StatusLabel>{props.status}</StatusLabel>
}
