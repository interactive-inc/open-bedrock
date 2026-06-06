import { Suspense } from "react"
import { RewardManagement } from "@/app/(app)/thanks/reward-management"
import { ThanksCreateForm } from "@/app/(app)/thanks/thanks-create-form"
import { ThanksExchangeBalance } from "@/app/(app)/thanks/thanks-exchange-balance"
import { ThanksList } from "@/app/(app)/thanks/thanks-list"
import { ThanksRewards } from "@/app/(app)/thanks/thanks-rewards"
import { ThanksSummary } from "@/app/(app)/thanks/thanks-summary"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "感謝" }

// 感謝（サンクス）画面。原資・残高サマリ、送付フォーム、「景品を交換する」（全社員）、
// 「景品の管理」（管理権限のみ・見出しごと出し分け）、公開タイムラインを並べる RSC。
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
        <h2 className="text-lg font-medium">景品を交換する</h2>

        <p className="text-sm text-muted-foreground">
          受領残高（交換可能ポイント）で景品と交換できます。管理権限の有無に関わらず、全社員が交換を申請できます。
        </p>

        <Suspense fallback={<Skeleton className="h-20 w-full" />}>
          <ThanksExchangeBalance />
        </Suspense>

        <Suspense fallback={<ThanksListSkeleton />}>
          <ThanksRewards />
        </Suspense>
      </section>

      <Suspense fallback={null}>
        <RewardManagement />
      </Suspense>

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
