import Link from "next/link"
import { notFound } from "next/navigation"
import { SurveyAnswerForm } from "@/app/(app)/surveys/[surveyId]/_components/survey-answer-form"
import { surveyQuestionSchema } from "@/app/(app)/surveys/[surveyId]/_lib/survey-question-schema"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { getSurvey } from "@/lib/api/get-survey"
import { handleDetailError } from "@/lib/api/handle-detail-error"
import type { SurveyQuestion } from "@/lib/api/types/survey-types"

export const metadata = { title: "サーベイ回答" }

type Props = {
  // Next.js 16 では params は Promise なので await して使う。
  params: Promise<{ surveyId: string }>
}

// アンケート回答画面 (/surveys/:surveyId)。
// 専用の取得 API で対象アンケートを取得し、設問を回答フォームに渡す。
export default async function SurveyAnswerPage(props: Props) {
  const routeParams = await props.params

  const surveyId = Number(routeParams.surveyId)

  if (!Number.isInteger(surveyId)) {
    notFound()
  }

  const survey = await getSurvey(surveyId)

  if (survey instanceof Error) {
    handleDetailError(survey)
  }

  if (survey === null) {
    notFound()
  }

  const questions: Array<SurveyQuestion> = []

  for (const candidate of survey.questions_json) {
    const parsed = surveyQuestionSchema.safeParse(candidate)

    if (parsed.success) {
      questions.push(parsed.data)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={survey.title}
        actions={
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/surveys/${survey.id}/summary`} />}
          >
            集計を見る
          </Button>
        }
      />

      <SurveyAnswerForm surveyId={survey.id} questions={questions} />
    </div>
  )
}
