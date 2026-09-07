import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { evaluationKindLabel } from "@/app/(app)/performance-review/goals/[goal]/_lib/evaluation-kind-label"
import { formatDateTime } from "@/lib/format-date-time"
import { Button } from "@/components/ui/button"

type Evaluation = {
  id: number
  kind: string
  score: number | null
  comment: string | null
  created_at: string
}

type Props = {
  evaluations: ReadonlyArray<Evaluation>
}

/**
 * 目標詳細に登録済みの評価を登録順で表示するセクション。
 * api は評価者を employee_id でしか返さず数値 ID の表示は不自然なため、
 * 評価者欄は出さず種別（自己/上長/確定）で誰の評価かを示す。
 */
export function GoalEvaluationList(props: Props) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>評価</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {props.evaluations.length === 0 ? (
          <p className="text-muted-foreground">評価はまだ登録されていません</p>
        ) : (
          props.evaluations.map((evaluation) => (
            <div key={evaluation.id} className="flex flex-col gap-2 rounded-2xl bg-card border p-4">
              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" size="sm">
                  {evaluationKindLabel(evaluation.kind)}
                </Button>

                <span>
                  {evaluation.score === null ? "スコアなし" : `スコア ${evaluation.score}`}
                </span>

                <span className="ml-auto text-muted-foreground">
                  {formatDateTime(evaluation.created_at)}
                </span>
              </div>

              {evaluation.comment !== null ? (
                <p className="whitespace-pre-wrap text-muted-foreground">{evaluation.comment}</p>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
