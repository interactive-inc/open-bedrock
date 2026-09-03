import { FetchError } from "@/components/fetch-error"
import Link from "next/link"
import { GoalEvaluationForm } from "@/app/(app)/performance-review/goals/[goal]/_components/goal-evaluation-form"
import { GoalEvaluationList } from "@/app/(app)/performance-review/goals/[goal]/_components/goal-evaluation-list"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { getGoal } from "@/lib/api/get-goal"
import { getGoalEvaluations } from "@/lib/api/get-goal-evaluations"
import { statusLabel } from "@/lib/status-label"
import { getMe } from "@/lib/api/get-me"
import type { GoalEvaluationKind } from "@/lib/api/types/goal-types"

export const metadata = { title: "目標詳細" }

type Props = {
  params: Promise<{ goal: string }>
}

/**
 * 目標詳細画面。GET /performance-goals/:goal_id で単一目標を取得する RSC。
 * 詳細表示に加えて評価登録フォーム (POST /performance-goals/:id/evaluations) を置く。
 */
export default async function GoalDetailPage(props: Props) {
  const params = await props.params

  const goalId = Number(params.goal)

  if (!Number.isInteger(goalId)) {
    return <FetchError message="目標 ID が不正です" />
  }

  const [goal, evaluations, currentUser] = await Promise.all([
    getGoal(goalId),
    getGoalEvaluations(goalId),
    getMe(),
  ])

  if (goal instanceof Error) {
    return (
      <div className="flex flex-col gap-4">
        <FetchError message="目標の取得に失敗しました" />

        <Link
          href="/performance-review/goals"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          一覧へ戻る
        </Link>
      </div>
    )
  }

  const evaluationKinds: ReadonlyArray<GoalEvaluationKind> =
    currentUser instanceof Error
      ? []
      : goal.employee_id === currentUser.id
        ? ["self"]
        : currentUser.permissions.includes("goal:evaluate")
          ? ["manager", "final"]
          : []

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={goal.title}
        actions={<BackButton href="/performance-review/goals" label="一覧に戻る" />}
      />

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
            <Badge variant={goal.status === "done" ? "secondary" : "outline"}>
              {statusLabel(goal.status)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {evaluations instanceof Error ? (
        <FetchError message="評価の取得に失敗しました" />
      ) : (
        <GoalEvaluationList evaluations={evaluations} />
      )}

      {goal.id !== null && evaluationKinds.length > 0 ? (
        <GoalEvaluationForm goalId={goal.id} allowedKinds={evaluationKinds} />
      ) : null}
    </div>
  )
}
