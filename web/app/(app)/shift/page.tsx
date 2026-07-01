import { FetchError } from "@/components/fetch-error"
import { CalendarDays, Settings } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { MyShiftAssignments } from "@/app/(app)/shift/_components/my-shift-assignments"
import { MyShiftSwapRequests } from "@/app/(app)/shift/_components/my-shift-swap-requests"
import { ShiftSwapRequestForm } from "@/app/(app)/shift/_components/shift-swap-request-form"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getMe } from "@/lib/api/get-me"
import { getMyShiftAssignments } from "@/lib/api/get-my-shift-assignments"
import { getMyShiftSwapRequests } from "@/lib/api/get-my-shift-swap-requests"
import { canManageShift } from "@/lib/shift/can-manage-shift"
import { canViewAllShiftSwaps } from "@/lib/shift/can-view-all-shift-swaps"

export const metadata = { title: "シフト" }

/**
 * シフトのメイン画面。「自分のシフト」というオブジェクトに集中させ、
 * パターン一覧は /shift/patterns、横断割当・管理は /shift/manage に分離する。
 */
export default async function ShiftPage() {
  const currentUser = await getMe()

  const canManage = currentUser instanceof Error ? false : canManageShift(currentUser.role)

  const canViewAllSwaps =
    currentUser instanceof Error ? false : canViewAllShiftSwaps(currentUser.permissions)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="シフト"
        description="自分のシフトと交代申請を管理します。"
        actions={
          <>
            <Button variant="outline" nativeButton={false} render={<Link href="/shift/patterns" />}>
              <CalendarDays />
              パターン
            </Button>

            {canViewAllSwaps ? (
              <Button variant="outline" nativeButton={false} render={<Link href="/shift/admin" />}>
                交代管理
              </Button>
            ) : null}

            {canManage ? (
              <Button variant="outline" nativeButton={false} render={<Link href="/shift/manage" />}>
                <Settings />
                管理
              </Button>
            ) : null}
          </>
        }
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">自分のシフト</h2>

        <Suspense fallback={<ListSkeleton rows={3} />}>
          <MyShift />
        </Suspense>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">自分の交代申請</h2>

        <Suspense fallback={<ListSkeleton rows={3} />}>
          <MySwapRequests />
        </Suspense>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>シフト交代を申請</CardTitle>
        </CardHeader>

        <CardContent>
          <ShiftSwapRequestForm />
        </CardContent>
      </Card>
    </div>
  )
}

async function MyShift() {
  const assignments = await getMyShiftAssignments(null, null)

  if (assignments instanceof Error) {
    return <FetchError message="自分のシフトの取得に失敗しました" />
  }

  return <MyShiftAssignments assignments={assignments} />
}

async function MySwapRequests() {
  const swapRequests = await getMyShiftSwapRequests()

  if (swapRequests instanceof Error) {
    return <FetchError message="交代申請の取得に失敗しました" />
  }

  return <MyShiftSwapRequests swapRequests={swapRequests} />
}
