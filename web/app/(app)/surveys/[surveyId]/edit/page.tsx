import { notFound } from "next/navigation"
import { z } from "zod"
import { SurveyEditForm } from "@/app/(app)/surveys/[surveyId]/edit/_components/survey-edit-form"
import { SurveyDeleteButton } from "@/app/(app)/surveys/manage/_components/survey-delete-button"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { getMe } from "@/lib/api/get-me"
import { getSurvey } from "@/lib/api/get-survey"
import { handleDetailError } from "@/lib/api/handle-detail-error"
import { canManageSurveys } from "@/lib/survey/can-manage-surveys"

const questionSchema = z.array(
  z.object({
    id: z.string(),
    type: z.string(),
    text: z.string(),
    options: z.array(z.string()).optional(),
  }),
)

export const metadata = { title: "サーベイの編集" }

type Props = {
  params: Promise<{ surveyId: string }>
}

/**
 * アンケート編集ページ。Dialog 廃止により /surveys/manage の編集ボタンが遷移する先。
 */
export default async function EditSurveyPage(props: Props) {
  const routeParams = await props.params

  const surveyId = Number(routeParams.surveyId)

  if (!Number.isInteger(surveyId)) {
    notFound()
  }

  const me = await getMe()

  if (me instanceof Error || !canManageSurveys(me.permissions)) {
    notFound()
  }

  const survey = await getSurvey(surveyId)

  if (survey instanceof Error) {
    handleDetailError(survey)
  }

  if (survey === null) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${survey.title} の編集`}
        description="タイトル・状態・設問を変更します。"
        actions={<BackButton href="/surveys/manage" label="管理に戻る" />}
      />

      <Card className="max-w-2xl">
        <CardContent>
          <SurveyEditForm
            id={survey.id}
            title={survey.title}
            status={survey.status === "closed" ? "closed" : "open"}
            questionsJson={questionSchema.catch([]).parse(survey.questions_json)}
          />
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            アンケートを削除すると回答もまとめて消えます。
          </p>

          <SurveyDeleteButton id={survey.id} />
        </CardContent>
      </Card>
    </div>
  )
}
