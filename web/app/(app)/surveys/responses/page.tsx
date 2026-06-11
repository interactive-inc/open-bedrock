import { Suspense } from "react"
import { MyResponsesList } from "@/app/(app)/surveys/_components/my-responses-list"
import { listMySurveyResponses } from "@/lib/api/list-my-survey-responses"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "自分の回答" }

// 自分のアンケート回答一覧画面 (/surveys/responses)。
// 一覧取得は非同期 RSC を Suspense 境界に包み、取得中は Skeleton を出す。
export default function MySurveyResponsesPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">自分の回答</h1>

      <Suspense fallback={<MyResponsesSkeleton />}>
        <MyResponsesSection />
      </Suspense>
    </div>
  )
}

// 回答一覧を取得して一覧コンポーネントへ渡す非同期 RSC。
async function MyResponsesSection() {
  const responses = await listMySurveyResponses()

  if (responses instanceof Error) {
    return <p className="text-sm text-destructive">回答の取得に失敗しました</p>
  }

  return <MyResponsesList responses={responses} />
}

function MyResponsesSkeleton() {
  const placeholders = [0, 1, 2]

  return (
    <div className="flex flex-col gap-3">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
  )
}
