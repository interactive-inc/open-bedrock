import { Badge } from "@/components/ui/badge"
import type { PayslipStatus } from "@/lib/api/types/payroll-types"

type Props = {
  status: PayslipStatus
}

// 給与明細ステータスを日本語ラベルと配色付きの Badge で表示する。
export function PayslipStatusBadge(props: Props) {
  if (props.status === "issued") {
    return <Badge className="bg-emerald-600 text-white">発行済み</Badge>
  }

  return <Badge variant="secondary">下書き</Badge>
}
