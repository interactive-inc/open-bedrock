import { Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { MyBusinessTripsSection } from "@/app/(app)/my/business-trips/_components/my-business-trips-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"

export const metadata = { title: "出張" }

/**
 * 出張申請の自分の申請一覧画面。新規申請は /new に分離。
 */
export default function BusinessTripsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="出張"
        actions={
          <Button nativeButton={false} render={<Link href="/my/business-trips/new" />}>
            <Plus />
            新規申請
          </Button>
        }
      />

      <Suspense fallback={<ListSkeleton rows={4} rowClassName="h-10 w-full" />}>
        <MyBusinessTripsSection />
      </Suspense>
    </div>
  )
}
