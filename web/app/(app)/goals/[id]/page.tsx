import Link from "next/link"
import { GoalEvaluationForm } from "@/app/(app)/goals/[id]/goal-evaluation-form"
import { getGoalList } from "@/lib/api/get-goal-list"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Props = {
  params: Promise<{ id: string }>
}

// 目標詳細画面。GET /goals/:id の専用エンドポイントが無いため一覧から該当を抽出する RSC。
// 詳細表示に加えて評価登録フォーム (POST /goals/:id/evaluations) を置く。
export default async function GoalDetailPage(props: Props) {
  const params = await props.params

  const goalId = Number(params.id)

  if (!Number.isInteger(goalId)) {
    return <p className="text-sm text-destructive">目標 ID が不正です</p>
  }

  const goals = await getGoalList({ period: null, employeeId: null })

  if (goals instanceof Error) {
    return <p className="text-sm text-destructive">目標の取得に失敗しました</p>
  }

  const goal = goals.find((target) => target.id === goalId) ?? null

  if (goal === null) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">目標が見つかりませんでした</p>

        <Link href="/goals" className="text-sm text-primary underline-offset-4 hover:underline">
          一覧へ戻る
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/goals" className="text-sm text-primary underline-offset-4 hover:underline">
          一覧へ戻る
        </Link>

        <h1 className="text-2xl font-semibold">{goal.title}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">概要</CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="flex gap-2">
            <span className="w-24 text-muted-foreground">期間</span>
            <span>{goal.period}</span>
          </div>

          <div className="flex gap-2">
            <span className="w-24 text-muted-foreground">KPI</span>
            <span>{goal.kpi ?? "-"}</span>
          </div>

          <div className="flex gap-2">
            <span className="w-24 text-muted-foreground">ウェイト</span>
            <span>{goal.weight}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-24 text-muted-foreground">ステータス</span>
            <Badge variant={goal.status === "done" ? "secondary" : "outline"}>{goal.status}</Badge>
          </div>
        </CardContent>
      </Card>

      <GoalEvaluationForm goalId={goal.id} />
    </div>
  )
}
