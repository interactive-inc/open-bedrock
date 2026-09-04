import { notFound } from "next/navigation"
import { ShiftPatternCreateForm } from "@/app/(app)/my/shifts/_components/shift-pattern-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { getMe } from "@/lib/api/get-me"
import { canManageShift } from "@/lib/shift/can-manage-shift"

export const metadata = { title: "シフトパターンを作成" }

/**
 * シフトパターン作成画面（特権ロールのみ）。作成後は /shift/patterns へ redirect する。
 * 権限が無いユーザーには 404 を返し UI を露出しない。
 */
export default async function ShiftPatternNewPage() {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageShift(currentUser.permissions) === false) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="シフトパターンを作成">
        <BackButton href="/shift/shift-patterns" label="一覧に戻る" />
      </PageHeader>

      <Card>
        <CardContent>
          <ShiftPatternCreateForm />
        </CardContent>
      </Card>
    </div>
  )
}
