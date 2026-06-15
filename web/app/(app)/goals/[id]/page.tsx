import { FetchError } from "@/components/fetch-error"
import Link from "next/link"
import { GoalEvaluationForm } from "@/app/(app)/goals/[id]/_components/goal-evaluation-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { getGoal } from "@/lib/api/get-goal"

export const metadata = { title: "目標詳細" }

type Props = {
  params: Promise<{ id: string }>
}

// 目標詳細画面。GET /goals/:goal_id で単一目標を取得する RSC。
// 詳細表示に加えて評価登録フォーム (POST /goals/:id/evaluations) を置く。
export default async function GoalDetailPage(props: Props) {
  const params = await props.params

  const goalId = Number(params.id)

  if (!Number.isInteger(goalId)) {
    return <FetchError message="目標 ID が不正です" />
  }

  const goal = await getGoal(goalId)

  if (goal instanceof Error) {
    return (
      <div className="flex flex-col gap-4">
        <FetchError message="目標の取得に失敗しました" />

        <Link href="/goals" className="text-sm text-primary underline-offset-4 hover:underline">
          一覧へ戻る
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={goal.title} actions={<BackButton href="/goals" label="一覧に戻る" />} />

      <Card>
        <CardHeader>
          <CardDescription>概要</CardDescription>
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

      {goal.id !== null && <GoalEvaluationForm goalId={goal.id} />}
    </div>
  )
}
