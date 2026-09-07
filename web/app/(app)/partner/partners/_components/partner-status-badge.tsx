import { Button } from "@/components/ui/button"

type Props = {
  status: string
}

/** 取引先の状態を日本語ラベルと配色付きの Button で表示する。 */
export function PartnerStatusBadge(props: Props) {
  if (props.status === "active") {
    return (
      <Button type="button" size="sm">
        取引中
      </Button>
    )
  }

  if (props.status === "archived") {
    return (
      <Button type="button" variant="secondary" size="sm">
        終了
      </Button>
    )
  }

  return (
    <Button type="button" variant="secondary" size="sm">
      {props.status}
    </Button>
  )
}
