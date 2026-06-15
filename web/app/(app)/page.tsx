import { Suspense } from "react"
import { DashboardSummaryCards } from "@/app/(app)/_components/dashboard-summary-cards"
import { PageHeader } from "@/components/page-header"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "ホーム" }

/**
 * ルート `/` のホーム画面。主要オブジェクトの件数サマリを並べる。
 */
export default function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="ホーム" description="主要な人数・申請・サーベイの状況を一望する。" />

      <Suspense fallback={<DashboardSummarySkeleton />}>
        <DashboardSummaryCards />
      </Suspense>
    </div>
  )
}

function DashboardSummarySkeleton() {
  const placeholders = [0, 1, 2, 3]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-28 w-full" />
      ))}
    </div>
  )
}
