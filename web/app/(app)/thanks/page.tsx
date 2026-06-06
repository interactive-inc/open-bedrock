import { Suspense } from "react"
import { ThanksCreateForm } from "@/app/(app)/thanks/thanks-create-form"
import { ThanksList } from "@/app/(app)/thanks/thanks-list"
import { ThanksRewards } from "@/app/(app)/thanks/thanks-rewards"
import { ThanksSummary } from "@/app/(app)/thanks/thanks-summary"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "感謝" }

// 感謝（サンクス）画面。原資・残高サマリ、送付フォーム、交換カタログ、公開タイムラインを並べる RSC。
// サマリ・カタログ・一覧は最新値を取得するため動的レンダリングになる。
export default function ThanksPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">感謝</h1>

      <Suspense fallback={<SummarySkeleton />}>
        <ThanksSummary />
      </Suspense>

      <ThanksCreateForm />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">ポイントを交換する</h2>

        <Suspense fallback={<ThanksListSkeleton />}>
          <ThanksRewards />
        </Suspense>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">みんなの感謝</h2>

        <Suspense fallback={<ThanksListSkeleton />}>
          <ThanksList />
        </Suspense>
      </section>
    </div>
  )
}

function SummarySkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Skeleton className="h-24 w-full" />

      <Skeleton className="h-24 w-full" />
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
