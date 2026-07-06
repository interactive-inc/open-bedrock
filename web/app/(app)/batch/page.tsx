import { notFound } from "next/navigation"
import { Suspense } from "react"
import { BatchJobList } from "@/app/(app)/batch/_components/batch-job-list"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { getMe } from "@/lib/api/get-me"
import { canManageBatch } from "@/lib/batch/can-manage-batch"

export const metadata = { title: "バッチ" }

// バッチジョブ状況一覧（/batch）画面。ジョブ名 / 状態 / 最終実行を一覧表示する RSC。
// データ取得は子の非同期 RSC に委譲し、ここでは Suspense でフォールバックを出す。
// batch:view 権限を持つ場合のみアクセス可能（defense-in-depth）。
export default async function BatchPage() {
  const me = await getMe()

  if (me instanceof Error || canManageBatch(me.permissions) === false) {
    notFound()
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="バッチジョブ状況"
        description="バックグラウンドで実行されるジョブの最新の実行状況を確認できます。"
      />

      <Suspense fallback={<ListSkeleton rows={5} />}>
        <BatchJobList />
      </Suspense>
    </div>
  )
}
