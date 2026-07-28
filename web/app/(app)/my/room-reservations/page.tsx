import { Suspense } from "react"
import { MyReservationsSection } from "@/app/(app)/organization/rooms/_components/my-reservations-section"
import { BackButton } from "@/components/back-button"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"

export const metadata = { title: "自分の会議室予約" }

/**
 * 自分の会議室予約一覧。予約管理は別画面（/rooms）から行う。
 */
export default function MyReservationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="自分の予約"
        description="自分が予約した会議室の一覧と取消を行います。"
        actions={<BackButton href="/organization/rooms" label="会議室に戻る" />}
      />

      <Suspense fallback={<ListSkeleton rows={4} rowClassName="h-10 w-full" />}>
        <MyReservationsSection />
      </Suspense>
    </div>
  )
}
