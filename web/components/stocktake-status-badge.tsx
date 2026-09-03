import { Badge } from "@/components/ui/badge"

type Props = {
  status: string
}

/** 棚卸しセッションの状態を日本語ラベルと配色付きの Badge で表示する。 */
export function StocktakeStatusBadge(props: Props) {
  if (props.status === "open") {
    return <Badge>実施中</Badge>
  }

  if (props.status === "closed") {
    return <Badge variant="secondary">締め済み</Badge>
  }

  return <Badge variant="secondary">{props.status}</Badge>
}
