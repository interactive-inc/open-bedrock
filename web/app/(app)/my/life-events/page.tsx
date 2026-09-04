import { Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { MyLifeEventsSection } from "@/app/(app)/my/life-events/_components/my-life-events-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"

export const metadata = { title: "ライフイベント" }

/**
 * ライフイベントの自分の届出一覧画面。新規届出は /new に分離。
 */
export default function LifeEventsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="ライフイベント">
        <Button nativeButton={false} render={<Link href="/my/life-events/new" />}>
          <Plus />
          新規届出
        </Button>
      </PageHeader>

      <Suspense fallback={<ListSkeleton rows={4} rowClassName="h-10 w-full" />}>
        <MyLifeEventsSection />
      </Suspense>
    </div>
  )
}
