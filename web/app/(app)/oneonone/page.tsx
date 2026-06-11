import { Suspense } from "react"
import { OneOnOneCreateForm } from "@/app/(app)/oneonone/_components/oneonone-create-form"
import { OneOnOneList } from "@/app/(app)/oneonone/_components/oneonone-list"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "1on1" }

// 1on1 画面。記録作成フォームと履歴一覧を並べる RSC。
// 一覧は本人参加分を取得するため動的レンダリングになる。
export default function OneOnOnePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">1on1</h1>

      <OneOnOneCreateForm />

      <Suspense fallback={<OneOnOneListSkeleton />}>
        <OneOnOneList />
      </Suspense>
    </div>
  )
}

function OneOnOneListSkeleton() {
  const placeholders = [0, 1, 2]

  return (
    <div className="flex flex-col gap-4">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-32 w-full" />
      ))}
    </div>
  )
}
