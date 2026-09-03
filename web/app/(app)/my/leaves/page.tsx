import { Inbox, Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { LeaveBalanceCards } from "@/app/(app)/my/leaves/_components/leave-balance-cards"
import { MyLeaveRequestsTable } from "@/app/(app)/my/leaves/_components/my-leave-requests-table"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getMe } from "@/lib/api/get-me"
import { canViewAllLeaves } from "@/lib/leave/can-view-all-leaves"

export const metadata = { title: "休暇" }

const leaveBalanceSkeletonPlaceholders = [0, 1, 2]

/**
 * 休暇のメイン画面。残日数と自分の申請一覧に集中させ、申請フォームは /leave/new に分離する。
 */
export default async function LeavePage() {
  const currentUser = await getMe()

  const canViewAll =
    currentUser instanceof Error ? false : canViewAllLeaves(currentUser.permissions)

  const canApprove =
    currentUser instanceof Error ? false : currentUser.permissions.includes("leave:approve")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="休暇"
        description="残日数を確認し、自分の申請状況を見ます。"
        actions={
          <>
            {canViewAll ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/leave/leaves" />}
              >
                休暇申請管理
              </Button>
            ) : null}

            {canApprove ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/inbox/leaves" />}
              >
                <Inbox />
                承認受信箱
              </Button>
            ) : null}

            <Button nativeButton={false} render={<Link href="/my/leaves/new" />}>
              <Plus />
              休暇を申請
            </Button>
          </>
        }
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">残日数</h2>

        <Suspense fallback={<LeaveBalanceSkeleton />}>
          <LeaveBalanceCards />
        </Suspense>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">自分の申請</h2>

        <Suspense fallback={<ListSkeleton rows={5} />}>
          <MyLeaveRequestsTable />
        </Suspense>
      </section>
    </div>
  )
}

function LeaveBalanceSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {leaveBalanceSkeletonPlaceholders.map((index) => (
        <Skeleton key={index} className="h-28 w-full" />
      ))}
    </div>
  )
}
