import { Suspense } from "react"
import { DashboardSummaryCards } from "@/app/(app)/dashboard/dashboard-summary-cards"
import { Skeleton } from "@/components/ui/skeleton"

// Dashboard 画面。非同期サマリは Suspense 境界で Skeleton をフォールバックにする。
export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">ダッシュボード</h1>

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
