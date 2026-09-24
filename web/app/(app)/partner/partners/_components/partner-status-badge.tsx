import { StatusLabel } from "@/components/status-label"

type Props = {
  status: string
}

/** 取引先の状態を日本語ラベルと配色付きの StatusLabel で表示する。 */
export function PartnerStatusBadge(props: Props) {
  if (props.status === "active") {
    return <StatusLabel>取引中</StatusLabel>
  }

  if (props.status === "archived") {
    return <StatusLabel>終了</StatusLabel>
  }

  return <StatusLabel>{props.status}</StatusLabel>
}
