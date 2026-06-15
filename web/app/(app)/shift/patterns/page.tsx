import { FetchError } from "@/components/fetch-error"
import { Suspense } from "react"
import { ShiftPatternCreateForm } from "@/app/(app)/shift/_components/shift-pattern-create-form"
import { ShiftPatternList } from "@/app/(app)/shift/_components/shift-pattern-list"
import { BackButton } from "@/components/back-button"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getMe } from "@/lib/api/get-me"
import { getShiftPatterns } from "@/lib/api/get-shift-patterns"
import { canManageShift } from "@/lib/shift/can-manage-shift"

export const metadata = { title: "シフトパターン" }

/**
 * シフトパターン一覧。「パターン」というオブジェクトに集中させ、
 * 特権ロールには新規作成フォームを併設する。
 */
export default async function ShiftPatternsPage() {
  const currentUser = await getMe()

  const canManage = currentUser instanceof Error ? false : canManageShift(currentUser.role)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="シフトパターン"
        description="シフトの定型パターンを一覧します。"
        actions={<BackButton href="/shift" label="シフトに戻る" />}
      />

      <Suspense fallback={<ListSkeleton rows={3} />}>
        <Patterns canManage={canManage} />
      </Suspense>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>シフトパターンを作成</CardTitle>
          </CardHeader>

          <CardContent>
            <ShiftPatternCreateForm />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

async function Patterns(props: { canManage: boolean }) {
  const patterns = await getShiftPatterns()

  if (patterns instanceof Error) {
    return <FetchError message="シフトパターンの取得に失敗しました" />
  }

  return <ShiftPatternList patterns={patterns} canManage={props.canManage} />
}
