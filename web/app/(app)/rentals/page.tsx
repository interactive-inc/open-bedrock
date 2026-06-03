import { Suspense } from "react"
import { MyReservationsSection } from "@/app/(app)/rentals/my-reservations-section"
import { RentalReservationCreateForm } from "@/app/(app)/rentals/rental-reservation-create-form"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "レンタル" }

// レンタル画面。申請フォームと、本人のレンタル予約一覧を Suspense 境界で描画する RSC。
export default function RentalsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">レンタル</h1>

      <RentalReservationCreateForm />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">自分の予約</h2>

        <Suspense fallback={<RentalsSkeleton />}>
          <MyReservationsSection />
        </Suspense>
      </section>
    </div>
  )
}

function RentalsSkeleton() {
  const placeholders = [0, 1, 2, 3]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  )
}
