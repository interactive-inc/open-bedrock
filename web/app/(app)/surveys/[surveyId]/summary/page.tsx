import { FetchError } from "@/components/fetch-error"
import Link from "next/link"
import { notFound } from "next/navigation"
import { SurveyQuestionSummaryCard } from "@/app/(app)/surveys/[surveyId]/summary/_components/survey-question-summary-card"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { getSurveySummary } from "@/lib/api/get-survey-summary"

export const metadata = { title: "サーベイ集計" }

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
    return <FetchError message="集計の取得に失敗しました" />
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={summary.title}
        description={`回答 ${summary.response_count} 件`}
        actions={
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/surveys/${summary.survey_id}`} />}
          >
            回答する
          </Button>
        }
      />

      {summary.questions.length === 0 ? (
        <EmptyState title="集計対象の設問がありません" />
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
