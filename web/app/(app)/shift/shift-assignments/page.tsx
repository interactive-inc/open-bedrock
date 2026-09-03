import { FetchError } from "@/components/fetch-error"
import { Plus } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { ShiftAssignmentList } from "@/app/(app)/my/shifts/_components/shift-assignment-list"
import { BackButton } from "@/components/back-button"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { getMe } from "@/lib/api/get-me"
import { getShiftAssignments } from "@/lib/api/get-shift-assignments"
import { getShiftPatterns } from "@/lib/api/get-shift-patterns"
import { canManageShift } from "@/lib/shift/can-manage-shift"

export const metadata = { title: "シフト管理" }

/**
 * シフトの管理（特権ロールのみ）。横断割当一覧を表示し、新規割当は /shift/manage/new に分離する。
 * 権限が無いユーザーには 404 を返し UI を露出しない。
 */
export default async function ShiftManagePage() {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageShift(currentUser.permissions) === false) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="シフト管理"
        actions={
          <>
            <BackButton href="/my/shifts" label="シフトに戻る" />

            <Button nativeButton={false} render={<Link href="/shift/shift-assignments/new" />}>
              <Plus />
              シフトを割り当て
            </Button>
          </>
        }
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">シフト割当（横断）</h2>

        <Suspense fallback={<ListSkeleton rows={3} />}>
          <AllAssignments />
        </Suspense>
      </section>
    </div>
  )
}

async function AllAssignments() {
  const assignments = await getShiftAssignments({ from: null, to: null, deptCode: null })

  if (assignments instanceof Error) {
    return <FetchError message="シフト割当一覧の取得に失敗しました" />
  }

  const patterns = await getShiftPatterns()

  const patternNameMap: Record<number, string> =
    patterns instanceof Error
      ? {}
      : Object.fromEntries(patterns.filter((p) => p.id !== null).map((p) => [p.id, p.name]))

  return (
    <ShiftAssignmentList
      assignments={assignments}
      canManage={true}
      employeeNameMap={{}}
      patternNameMap={patternNameMap}
    />
  )
}
