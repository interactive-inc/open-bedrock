import Link from "next/link"
import { notFound } from "next/navigation"
import { SurveyQuestionSummaryCard } from "@/app/(app)/surveys/[surveyId]/summary/survey-question-summary-card"
import { getSurveySummary } from "@/lib/api/get-survey-summary"
import { Button } from "@/components/ui/button"

type Props = {
  // Next.js 16 では params は Promise なので await して使う。
  params: Promise<{ surveyId: string }>
}

// アンケート集計画面 (/surveys/:surveyId/summary)。
// 回答件数と設問ごとの集計（スケール/選択肢は分布、自由記述は一覧）を表示する。
export default async function SurveySummaryPage(props: Props) {
  const routeParams = await props.params

  const surveyId = Number(routeParams.surveyId)

  if (!Number.isInteger(surveyId)) {
    notFound()
  }

  const summary = await getSurveySummary(surveyId)

  if (summary instanceof Error) {
    return <p className="text-sm text-destructive">集計の取得に失敗しました</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{summary.title}</h1>

          <p className="text-sm text-muted-foreground">回答 {summary.response_count} 件</p>
        </div>

        <Button
          variant="outline"
          size="sm"
          render={<Link href={`/surveys/${summary.survey_id}`} />}
        >
          回答する
        </Button>
      </div>

      {summary.questions.length === 0 ? (
        <p className="text-sm text-muted-foreground">集計対象の設問がありません</p>
      ) : (
        <div className="flex flex-col gap-4">
          {summary.questions.map((question) => (
            <SurveyQuestionSummaryCard key={question.id} question={question} />
          ))}
        </div>
      )}
    </div>
  )
}
