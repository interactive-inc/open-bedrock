import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import type { ManagementDashboard } from "@/app/(app)/dashboard/management/_lib/management-dashboard-types"

type Props = {
  summary: ManagementDashboard
}

// 経営ダッシュボードの主要メトリクスをカードで並べる。集計値の表示のみ。
export function ManagementMetricCards(props: Props) {
  const cards = [
    { label: "在籍者数", value: props.summary.employee_count },
    { label: "直近30日の入社", value: props.summary.recent_join_count },
    { label: "直近30日の退職", value: props.summary.recent_retire_count },
    { label: "当月の勤怠打刻", value: props.summary.attendance_record_count },
    { label: "当月の休暇申請", value: props.summary.leave_request_count },
    { label: "休暇の承認待ち", value: props.summary.leave_pending_count },
    { label: "当月の経費申請", value: props.summary.expense_count },
    { label: "経費の承認待ち", value: props.summary.expense_pending_count },
    { label: "実施中の評価サイクル", value: props.summary.open_review_cycle_count },
    { label: "申請の滞留（承認待ち）", value: props.summary.pending_application_count },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader>
            <CardDescription>{card.label}</CardDescription>
          </CardHeader>

          <CardContent>
            <span className="text-3xl font-semibold">{card.value}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
