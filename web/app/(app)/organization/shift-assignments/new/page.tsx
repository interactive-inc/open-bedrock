import { notFound } from "next/navigation"
import { ShiftAssignmentCreateForm } from "@/app/(app)/my/shifts/_components/shift-assignment-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { getEmployeeDirectory } from "@/lib/api/get-employee-directory"
import { getMe } from "@/lib/api/get-me"
import { canManageShift } from "@/lib/shift/can-manage-shift"

export const metadata = { title: "シフトを割り当て" }

/**
 * シフト割当作成画面（特権ロールのみ）。作成後は /shift/manage へ redirect する。
 * 権限が無いユーザーには 404 を返し UI を露出しない。
 */
export default async function ShiftAssignmentNewPage() {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageShift(currentUser.permissions) === false) {
    notFound()
  }

  const employeeResult = await getEmployeeDirectory()

  const employees =
    employeeResult instanceof Error
      ? []
      : employeeResult.items.map((e) => ({ code: e.code, name: e.name }))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="シフトを割り当て"
        description="対象社員・パターン・対象日を指定して割当を作成します。"
        actions={<BackButton href="/organization/shift-assignments" label="一覧に戻る" />}
      />

      <Card className="max-w-2xl">
        <CardContent>
          <ShiftAssignmentCreateForm employees={employees} />
        </CardContent>
      </Card>
    </div>
  )
}
