import { notFound } from "next/navigation"
import { Suspense } from "react"
import { BatchJobList } from "@/app/(app)/batch/_components/batch-job-list"
import { Skeleton } from "@/components/ui/skeleton"
import { getMe } from "@/lib/api/get-me"

export const metadata = { title: "バッチ" }

// バッチジョブ状況一覧（/batch）画面。ジョブ名 / 状態 / 最終実行を一覧表示する RSC。
// データ取得は子の非同期 RSC に委譲し、ここでは Suspense でフォールバックを出す。
// admin のみアクセス可能（defense-in-depth）。
export default async function BatchPage() {
  const me = await getMe()

  if (me instanceof Error || me.role !== "admin") {
    notFound()
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">バッチジョブ状況</h1>

        <p className="text-sm text-muted-foreground">
          バックグラウンドで実行されるジョブの最新の実行状況を確認できます。
        </p>
      </div>

      <Suspense fallback={<BatchJobListSkeleton />}>
        <BatchJobList />
      </Suspense>
    </div>
  )
}

function BatchJobListSkeleton() {
  const placeholders = [0, 1, 2, 3, 4]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}
