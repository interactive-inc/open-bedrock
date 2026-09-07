import { Button } from "@/components/ui/button"

type Props = {
  status: string
}

/** 従業員ステータスを日本語ラベル + 配色付き Button で表示する。 */
export function EmployeeStatusBadge(props: Props) {
  const label = toStatusLabel(props.status)

  const variant = toStatusVariant(props.status)

  return (
    <Button type="button" variant={variant} size="sm">
      {label}
    </Button>
  )
}

/** status コードを日本語ラベルに変換する。未知の値はそのまま返す。 */
function toStatusLabel(status: string): string {
  if (status === "active") {
    return "在籍"
  }

  if (status === "leave") {
    return "休職"
  }

  if (status === "retired") {
    return "退職"
  }

  if (status === "prehire") return "入社予定"

  return status
}

/** status コードを Button のバリアントに対応づける。 */
function toStatusVariant(status: string): "default" | "secondary" | "destructive" {
  if (status === "active") {
    return "default"
  }

  if (status === "leave") {
    return "secondary"
  }

  if (status === "retired") {
    return "destructive"
  }

  return "secondary"
}
