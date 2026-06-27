import { FetchError } from "@/components/fetch-error"
import { getDashboard } from "@/lib/api/get-dashboard"
import { getMe } from "@/lib/api/get-me"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"

// /dashboard を認証付きで取得して 4 つのサマリカードを描画する非同期 RSC。
// dashboard:view 権限が無いユーザーにはサマリを出さず、案内文を表示する。
export async function DashboardSummaryCards() {
  const me = await getMe()

  if (me instanceof Error) {
    return <FetchError message="ユーザー情報の取得に失敗しました" />
  }

  if (me.permissions.includes("dashboard:view") === false) {
    return (
      <p className="text-sm text-muted-foreground">
        全体サマリの閲覧権限がありません。左のメニューから自分の業務をご利用ください。
      </p>
    )
  }

  const summary = await getDashboard()

  if (summary instanceof Error) {
    return <FetchError message="サマリの取得に失敗しました" />
  }

  const cards = [
    { label: "従業員", value: summary.employee_count },
    { label: "進行中の目標", value: summary.open_goal_count },
    { label: "承認待ち申請", value: summary.pending_application_count },
    { label: "実施中サーベイ", value: summary.open_survey_count },
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
