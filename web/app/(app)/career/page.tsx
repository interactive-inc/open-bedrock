import { Suspense } from "react"
import { CareerPostingsAdminSection } from "@/app/(app)/career/_components/career-postings-admin-section"
import { CareerPostingsSection } from "@/app/(app)/career/_components/career-postings-section"
import { CareerSheetSection } from "@/app/(app)/career/_components/career-sheet-section"
import { MyApplicationsSection } from "@/app/(app)/career/_components/my-applications-section"
import { Skeleton } from "@/components/ui/skeleton"
import { getMe } from "@/lib/api/get-me"
import { canManageCareerPostings } from "@/lib/career/can-manage-career-postings"

export const metadata = { title: "キャリア" }

// キャリア画面。本人のキャリアシート編集と社内公募一覧・応募を 1 画面に集約する。
// 管理ロールには公募の作成・変更・削除セクションを追加で表示する。
// 各セクションは非同期 RSC を Suspense 境界で囲み Skeleton をフォールバックにする。
export default async function CareerPage() {
  const currentUser = await getMe()

  const canManage = currentUser instanceof Error ? false : canManageCareerPostings(currentUser.role)

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">キャリア</h1>

        <Suspense fallback={<Skeleton className="h-72 w-full" />}>
          <CareerSheetSection />
        </Suspense>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">社内公募</h2>

        <Suspense fallback={<CareerPostingsSkeleton />}>
          <CareerPostingsSection />
        </Suspense>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">自分の応募</h2>

        <Suspense fallback={<Skeleton className="h-48 w-full" />}>
          <MyApplicationsSection />
        </Suspense>
      </section>

      {canManage ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">公募の管理</h2>

          <Suspense fallback={<Skeleton className="h-72 w-full" />}>
            <CareerPostingsAdminSection />
          </Suspense>
        </section>
      ) : null}
    </div>
  )
}

function CareerPostingsSkeleton() {
  const placeholders = [0, 1]

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-48 w-full" />
      ))}
    </div>
  )
}
