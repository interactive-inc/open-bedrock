import { Button } from "@/components/ui/button"
import type { ApplicationStatus } from "@/lib/api/types/application-types"

type Props = {
  status: ApplicationStatus
  returned?: boolean
}

/** 申請ステータスを日本語ラベルの Button で表示する。却下・失敗だけ destructive にし、他は secondary に揃える。 */
export function ApplicationStatusBadge(props: Props) {
  if (props.returned === true) {
    return (
      <Button type="button" variant="secondary" size="sm">
        差戻し
      </Button>
    )
  }

  if (props.status === "approved") {
    return (
      <Button type="button" variant="secondary" size="sm">
        承認済み
      </Button>
    )
  }

  if (props.status === "rejected") {
    return (
      <Button type="button" variant="destructive" size="sm">
        却下
      </Button>
    )
  }

  return (
    <Button type="button" variant="secondary" size="sm">
      承認待ち
    </Button>
  )
}
