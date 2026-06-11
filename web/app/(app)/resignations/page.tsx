import { Suspense } from "react"
import { MyResignationsSection } from "@/app/(app)/resignations/_components/my-resignations-section"
import { ResignationCreateForm } from "@/app/(app)/resignations/_components/resignation-create-form"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "退職申請" }

// 退職申請画面。申請フォームと非同期の自分の申請一覧を Suspense 境界で描画する RSC。
export default function ResignationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">退職申請</h1>

      <ResignationCreateForm />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">自分の申請</h2>

        <Suspense fallback={<ResignationsSkeleton />}>
          <MyResignationsSection />
        </Suspense>
      </section>
    </div>
  )
}

function ResignationsSkeleton() {
  const placeholders = [0, 1, 2, 3]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  )
}
