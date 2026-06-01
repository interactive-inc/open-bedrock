import Link from "next/link"
import { Suspense } from "react"
import { LeaveBalanceCards } from "@/app/(app)/leave/leave-balance-cards"
import { LeaveRequestCreateForm } from "@/app/(app)/leave/leave-request-create-form"
import { MyLeaveRequestsTable } from "@/app/(app)/leave/my-leave-requests-table"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "休暇" }

// 休暇画面。残日数カード・申請フォーム・自分の申請一覧を並べる RSC。
// 承認者は承認 inbox へ遷移できる。
export default function LeavePage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">休暇</h1>

        <Button variant="outline" render={<Link href="/leave/inbox" />}>
          承認 inbox
        </Button>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">残日数</h2>

        <Suspense fallback={<LeaveBalanceSkeleton />}>
          <LeaveBalanceCards />
        </Suspense>
      </section>

      <LeaveRequestCreateForm />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">自分の申請</h2>

        <Suspense fallback={<LeaveTableSkeleton />}>
          <MyLeaveRequestsTable />
        </Suspense>
      </section>
    </div>
  )
}

function LeaveBalanceSkeleton() {
  const placeholders = [0, 1, 2]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-28 w-full" />
      ))}
    </div>
  )
}

function LeaveTableSkeleton() {
  const placeholders = [0, 1, 2, 3, 4]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}
