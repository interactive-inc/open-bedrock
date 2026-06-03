import { Suspense } from "react"
import { BusinessTripCreateForm } from "@/app/(app)/business-trips/business-trip-create-form"
import { MyBusinessTripsSection } from "@/app/(app)/business-trips/my-business-trips-section"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "出張申請" }

// 出張申請画面。申請フォームと非同期の自分の申請一覧を Suspense 境界で描画する RSC。
export default function BusinessTripsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">出張申請</h1>

      <BusinessTripCreateForm />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">自分の申請</h2>

        <Suspense fallback={<BusinessTripsSkeleton />}>
          <MyBusinessTripsSection />
        </Suspense>
      </section>
    </div>
  )
}

function BusinessTripsSkeleton() {
  const placeholders = [0, 1, 2, 3]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  )
}
