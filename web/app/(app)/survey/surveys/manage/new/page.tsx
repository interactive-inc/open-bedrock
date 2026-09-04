import { notFound } from "next/navigation"
import { SurveyCreateForm } from "@/app/(app)/survey/surveys/manage/_components/survey-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { getMe } from "@/lib/api/get-me"
import { canManageSurveys } from "@/lib/survey/can-manage-surveys"

export const metadata = { title: "サーベイの新規作成" }

export default async function NewSurveyPage() {
  const me = await getMe()

  if (me instanceof Error || !canManageSurveys(me.permissions)) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="新規アンケート">
        <BackButton href="/survey/surveys/manage" label="管理に戻る" />
      </PageHeader>

      <Card>
        <CardContent>
          <SurveyCreateForm />
        </CardContent>
      </Card>
    </div>
  )
}
