import Link from "next/link"
import { notFound } from "next/navigation"
import { SurveyAnswerForm } from "@/app/(app)/surveys/[surveyId]/survey-answer-form"
import { getSurvey } from "@/lib/api/get-survey"
import { surveyQuestionSchema } from "@/app/(app)/surveys/[surveyId]/survey-question-schema"
import type { SurveyQuestion } from "@/lib/api/types/survey-types"
import { Button } from "@/components/ui/button"

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
    return <p className="text-sm text-destructive">アンケートの取得に失敗しました</p>
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
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{survey.title}</h1>

        <Button
          variant="outline"
          size="sm"
          render={<Link href={`/surveys/${survey.id}/summary`} />}
        >
          集計を見る
        </Button>
      </div>

      <SurveyAnswerForm surveyId={survey.id} questions={questions} />
    </div>
  )
}
