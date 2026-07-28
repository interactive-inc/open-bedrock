import { toDurationLabel } from "@/app/(app)/my/attendances/_lib/to-duration-label"
import { FetchError } from "@/components/fetch-error"
import { Card } from "@/components/ui/card"
import { getMyAttendanceSummary } from "@/lib/api/get-my-attendance-summary"

type Props = {
  // 対象月（YYYY-MM）。null のとき api 側で当月が使われる。
  month: string | null
}

/**
 * 本人の月次サマリをサーバ側 fetch してカード描画する非同期 RSC。
 * 勤務日数・総勤務時間を並べる。取得失敗時はメッセージ表示にフォールバックする。
 */
export async function AttendanceSummaryCard(props: Props) {
  const summary = await getMyAttendanceSummary({ month: props.month })

  if (summary instanceof Error) {
    return <FetchError message="月次サマリの取得に失敗しました" />
  }

  const stats = [
    { label: "対象月", value: summary.month },
    { label: "勤務日数", value: `${summary.work_days} 日` },
    { label: "総勤務時間", value: toDurationLabel(summary.total_work_minutes) },
  ]

  return (
    <Card className="p-0 gap-0">
      <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">{stat.label}</span>

            <span className="text-xl font-semibold">{stat.value}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
