import { Suspense } from "react"
import { LifeEventCreateForm } from "@/app/(app)/life-events/life-event-create-form"
import { MyLifeEventsSection } from "@/app/(app)/life-events/my-life-events-section"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "ライフイベント届出" }

// ライフイベント届出画面。届出フォームと非同期の自分の届出一覧を Suspense 境界で描画する RSC。
export default function LifeEventsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">ライフイベント届出</h1>

      <LifeEventCreateForm />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">自分の届出</h2>

        <Suspense fallback={<LifeEventsSkeleton />}>
          <MyLifeEventsSection />
        </Suspense>
      </section>
    </div>
  )
}

function LifeEventsSkeleton() {
  const placeholders = [0, 1, 2, 3]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  )
}
