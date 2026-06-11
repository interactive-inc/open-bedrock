import { Suspense } from "react"
import { YearEndAdjustmentCreateForm } from "@/app/(app)/year-end-adjustments/_components/year-end-adjustment-create-form"
import { MyYearEndAdjustmentsSection } from "@/app/(app)/year-end-adjustments/_components/my-year-end-adjustments-section"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "年末調整" }

// 年末調整画面。申告フォームと非同期の自分の申告一覧を Suspense 境界で描画する RSC。
export default function YearEndAdjustmentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">年末調整</h1>

      <YearEndAdjustmentCreateForm />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">自分の申告</h2>

        <Suspense fallback={<YearEndAdjustmentsSkeleton />}>
          <MyYearEndAdjustmentsSection />
        </Suspense>
      </section>
    </div>
  )
}

function YearEndAdjustmentsSkeleton() {
  const placeholders = [0, 1, 2, 3]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  )
}
