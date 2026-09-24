import { StatusLabel } from "@/components/status-label"

type Props = {
  status: string
}

/** 棚卸しセッションの状態を日本語ラベルの StatusLabel で表示する。却下・失効だけ destructive にし、他は secondary に揃える。 */
export function StocktakeStatusBadge(props: Props) {
  if (props.status === "open") {
    return <StatusLabel>実施中</StatusLabel>
  }

  if (props.status === "closed") {
    return <StatusLabel>締め済み</StatusLabel>
  }

  return <StatusLabel>{props.status}</StatusLabel>
}
