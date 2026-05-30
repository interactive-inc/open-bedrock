import { Badge } from "@/components/ui/badge"

type Props = {
  status: string
}

// 従業員ステータスを日本語ラベル + 配色付き Badge で表示する。
export function EmployeeStatusBadge(props: Props) {
  const label = toStatusLabel(props.status)

  const variant = toStatusVariant(props.status)

  return <Badge variant={variant}>{label}</Badge>
}

// status コードを日本語ラベルに変換する。未知の値はそのまま返す。
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

  return status
}

// status コードを Badge のバリアントに対応づける。
function toStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active") {
    return "default"
  }

  if (status === "leave") {
    return "secondary"
  }

  if (status === "retired") {
    return "destructive"
  }

  return "outline"
}
