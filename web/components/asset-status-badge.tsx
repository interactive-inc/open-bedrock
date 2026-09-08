import { Button } from "@/components/ui/button"

type Props = {
  status: string
}

/** 物品の在庫状態を日本語ラベルの Button で表示する。却下・失敗だけ destructive にし、他は secondary に揃える。 */
export function AssetStatusBadge(props: Props) {
  if (props.status === "lent") {
    return (
      <Button type="button" variant="secondary" size="sm">
        貸与中
      </Button>
    )
  }

  if (props.status === "in_stock") {
    return (
      <Button type="button" variant="secondary" size="sm">
        在庫
      </Button>
    )
  }

  if (props.status === "disposed") {
    return (
      <Button type="button" variant="secondary" size="sm">
        廃棄済み
      </Button>
    )
  }

  return (
    <Button type="button" variant="secondary" size="sm">
      {props.status}
    </Button>
  )
}
