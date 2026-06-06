import { Suspense } from "react"
import { ThanksCreateForm } from "@/app/(app)/thanks/thanks-create-form"
import { ThanksList } from "@/app/(app)/thanks/thanks-list"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "感謝" }

// 感謝（サンクス）画面。送付フォームと全員公開のタイムラインを並べる RSC。
// 一覧は最新の感謝を取得するため動的レンダリングになる。
export default function ThanksPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">感謝</h1>

      <ThanksCreateForm />

      <Suspense fallback={<ThanksListSkeleton />}>
        <ThanksList />
      </Suspense>
    </div>
  )
}

function ThanksListSkeleton() {
  const placeholders = [0, 1, 2]

  return (
    <div className="flex flex-col gap-4">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-24 w-full" />
      ))}
    </div>
  )
}
