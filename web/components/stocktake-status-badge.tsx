import { Button } from "@/components/ui/button"

type Props = {
  status: string
}

/** 棚卸しセッションの状態を日本語ラベルと配色付きの Button で表示する。 */
export function StocktakeStatusBadge(props: Props) {
  if (props.status === "open") {
    return (
      <Button type="button" size="sm">
        実施中
      </Button>
    )
  }

  if (props.status === "closed") {
    return (
      <Button type="button" variant="secondary" size="sm">
        締め済み
      </Button>
    )
  }

  return (
    <Button type="button" variant="secondary" size="sm">
      {props.status}
    </Button>
  )
}
