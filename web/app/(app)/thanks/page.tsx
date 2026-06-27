import { Gift, Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { ThanksList } from "@/app/(app)/thanks/_components/thanks-list"
import { ThanksSummary } from "@/app/(app)/thanks/_components/thanks-summary"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "感謝" }

/**
 * 感謝（サンクス）のメイン画面。サマリと公開タイムラインだけを並べる読み取り専用画面。
 * 送付は /thanks/send、景品は /thanks/rewards に分離。
 */
export default function ThanksPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="感謝"
        description="サンクスポイントの残量と、社内の感謝を見渡す。"
        actions={
          <>
            <Button variant="outline" nativeButton={false} render={<Link href="/thanks/rewards" />}>
              <Gift />
              景品を見る
            </Button>

            <Button nativeButton={false} render={<Link href="/thanks/send" />}>
              <Plus />
              感謝を送る
            </Button>
          </>
        }
      />

      <Suspense fallback={<SummarySkeleton />}>
        <ThanksSummary />
      </Suspense>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">みんなの感謝</h2>

        <Suspense fallback={<ListSkeleton rows={3} rowClassName="h-24 w-full" />}>
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
