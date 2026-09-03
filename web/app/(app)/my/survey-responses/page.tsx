import { FetchError } from "@/components/fetch-error"
import { Suspense } from "react"
import { MyResponsesList } from "@/app/(app)/survey/surveys/_components/my-responses-list"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { getSurveyList } from "@/lib/api/get-survey-list"
import { listMySurveyResponses } from "@/lib/api/list-my-survey-responses"

export const metadata = { title: "自分の回答" }

/**
 * 自分のアンケート回答一覧画面 (/surveys/responses)。
 * 一覧取得は非同期 RSC を Suspense 境界に包み、取得中は Skeleton を出す。
 */
export default function MySurveyResponsesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="自分の回答" description="自分が回答したアンケートを確認します。" />

      <Suspense fallback={<ListSkeleton rows={3} rowClassName="h-14 w-full" />}>
        <MyResponsesSection />
      </Suspense>
    </div>
  )
}

/** 回答一覧を取得して一覧コンポーネントへ渡す非同期 RSC。 */
async function MyResponsesSection() {
  const responses = await listMySurveyResponses()

  if (responses instanceof Error) {
    return <FetchError message="回答の取得に失敗しました" />
  }

  const surveys = await getSurveyList()

  const surveyTitleMap: Record<number, string> =
    surveys instanceof Error ? {} : Object.fromEntries(surveys.map((s) => [s.id, s.title]))

  return <MyResponsesList responses={responses} surveyTitleMap={surveyTitleMap} />
}
