import { FetchError } from "@/components/fetch-error"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { ShiftAssignmentCreateForm } from "@/app/(app)/shift/_components/shift-assignment-create-form"
import { ShiftAssignmentList } from "@/app/(app)/shift/_components/shift-assignment-list"
import { BackButton } from "@/components/back-button"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getEmployeeList } from "@/lib/api/get-employee-list"
import { getMe } from "@/lib/api/get-me"
import { getShiftAssignments } from "@/lib/api/get-shift-assignments"
import { canManageShift } from "@/lib/shift/can-manage-shift"

export const metadata = { title: "シフト管理" }

/**
 * シフトの管理（特権ロールのみ）。横断割当一覧と新規割当フォーム。
 * 権限が無いユーザーには 404 を返し UI を露出しない。
 */
export default async function ShiftManagePage() {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageShift(currentUser.role) === false) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="シフト管理"
        description="全員のシフト割当を確認し、新しい割当を作成します。"
        actions={<BackButton href="/shift" label="シフトに戻る" />}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">シフト割当（横断）</h2>

        <Suspense fallback={<ListSkeleton rows={3} />}>
          <AllAssignments />
        </Suspense>
      </section>

      <Suspense fallback={<ListSkeleton rows={2} />}>
        <CreateAssignmentSection />
      </Suspense>
    </div>
  )
}

async function AllAssignments() {
  const assignments = await getShiftAssignments({ from: null, to: null, deptCode: null })

  if (assignments instanceof Error) {
    return <FetchError message="シフト割当一覧の取得に失敗しました" />
  }

  return <ShiftAssignmentList assignments={assignments} canManage={true} />
}

async function CreateAssignmentSection() {
  const employeeResult = await getEmployeeList({ q: null, dept: null, status: "active" })

  const employees =
    employeeResult instanceof Error
      ? []
      : employeeResult.items.map((e) => ({ code: e.code, name: e.name }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>シフトを割り当て</CardTitle>
      </CardHeader>

      <CardContent>
        <ShiftAssignmentCreateForm employees={employees} />
      </CardContent>
    </Card>
  )
}
