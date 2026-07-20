import { Badge } from "@/components/ui/badge"

type Props = {
  status: string
}

/** 取引先の状態を日本語ラベルと配色付きの Badge で表示する。 */
export function PartnerStatusBadge(props: Props) {
  if (props.status === "active") {
    return <Badge className="bg-emerald-600 text-white">取引中</Badge>
  }

  if (props.status === "archived") {
    return <Badge variant="secondary">終了</Badge>
  }

  return <Badge variant="secondary">{props.status}</Badge>
}
