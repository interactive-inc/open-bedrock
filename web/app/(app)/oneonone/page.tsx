import { Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { OneOnOneList } from "@/app/(app)/oneonone/_components/oneonone-list"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"

export const metadata = { title: "1on1" }

/**
 * 1on1 履歴一覧。記録の作成は /oneonone/new に分離。
 */
export default function OneOnOnePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="1on1"
        description="自分の参加した 1on1 の履歴を確認します。"
        actions={
          <Button nativeButton={false} render={<Link href="/oneonone/new" />}>
            <Plus />
            記録を追加
          </Button>
        }
      />

      <Suspense fallback={<ListSkeleton rows={3} rowClassName="h-32 w-full" />}>
        <OneOnOneList />
      </Suspense>
    </div>
  )
}
