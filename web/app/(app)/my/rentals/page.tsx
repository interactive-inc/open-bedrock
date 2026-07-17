import { Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { MyReservationsSection } from "@/app/(app)/my/rentals/_components/my-reservations-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"

export const metadata = { title: "レンタル" }

/**
 * 自分のレンタル予約一覧。新規予約は /rentals/new に分離。
 */
export default function RentalsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="レンタル"
        description="自分の貸出予約を確認します。"
        actions={
          <Button nativeButton={false} render={<Link href="/my/rentals/new" />}>
            <Plus />
            新規予約
          </Button>
        }
      />

      <Suspense fallback={<ListSkeleton rows={4} rowClassName="h-10 w-full" />}>
        <MyReservationsSection />
      </Suspense>
    </div>
  )
}
