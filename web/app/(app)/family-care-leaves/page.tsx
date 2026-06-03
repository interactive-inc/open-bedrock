import { Suspense } from "react"
import { FamilyCareLeaveCreateForm } from "@/app/(app)/family-care-leaves/family-care-leave-create-form"
import { MyFamilyCareLeavesSection } from "@/app/(app)/family-care-leaves/my-family-care-leaves-section"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "産休・育休・介護休業の申出" }

// 休業申出画面。申出フォームと非同期の自分の申出一覧を Suspense 境界で描画する RSC。
export default function FamilyCareLeavesPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">産休・育休・介護休業の申出</h1>

      <FamilyCareLeaveCreateForm />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">自分の申出</h2>

        <Suspense fallback={<FamilyCareLeavesSkeleton />}>
          <MyFamilyCareLeavesSection />
        </Suspense>
      </section>
    </div>
  )
}

function FamilyCareLeavesSkeleton() {
  const placeholders = [0, 1, 2, 3]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  )
}
