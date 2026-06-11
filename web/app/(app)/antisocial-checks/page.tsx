import { Suspense } from "react"
import { AntisocialCheckCreateForm } from "@/app/(app)/antisocial-checks/_components/antisocial-check-create-form"
import { MyAntisocialChecksSection } from "@/app/(app)/antisocial-checks/_components/my-antisocial-checks-section"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "反社チェック申請" }

// 反社チェック申請画面。申請フォームと非同期の自分の申請一覧を Suspense 境界で描画する RSC。
export default function AntisocialChecksPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">反社チェック申請</h1>

      <AntisocialCheckCreateForm />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">自分の申請</h2>

        <Suspense fallback={<AntisocialChecksSkeleton />}>
          <MyAntisocialChecksSection />
        </Suspense>
      </section>
    </div>
  )
}

function AntisocialChecksSkeleton() {
  const placeholders = [0, 1, 2, 3]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  )
}
