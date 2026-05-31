import { Suspense } from "react"
import { MyShiftAssignments } from "@/app/(app)/shift/my-shift-assignments"
import { ShiftAssignmentCreateForm } from "@/app/(app)/shift/shift-assignment-create-form"
import { ShiftAssignmentList } from "@/app/(app)/shift/shift-assignment-list"
import { ShiftPatternCreateForm } from "@/app/(app)/shift/shift-pattern-create-form"
import { ShiftPatternList } from "@/app/(app)/shift/shift-pattern-list"
import { ShiftSwapRequestForm } from "@/app/(app)/shift/shift-swap-request-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getMe } from "@/lib/api/get-me"
import { getMyShiftAssignments } from "@/lib/api/get-my-shift-assignments"
import { getShiftAssignments } from "@/lib/api/get-shift-assignments"
import { getShiftPatterns } from "@/lib/api/get-shift-patterns"
import { canManageShift } from "@/lib/shift/can-manage-shift"

// シフト画面。自分の担当シフト・シフトパターン一覧を RSC で取得して表示し、交代申請フォームを併設する。
// 特権ロールには割当の横断一覧・割当作成・パターン作成フォームを追加で表示する。
export default async function ShiftPage() {
  const currentUser = await getMe()

  const canManage = currentUser instanceof Error ? false : canManageShift(currentUser.role)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">シフト</h1>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">自分のシフト</h2>

        <Suspense fallback={<ShiftSkeleton />}>
          <MyShift />
        </Suspense>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">シフトパターン</h2>

        <Suspense fallback={<ShiftSkeleton />}>
          <Patterns />
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

      {canManage ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">シフト割当（横断）</h2>

          <Suspense fallback={<ShiftSkeleton />}>
            <AllAssignments />
          </Suspense>
        </section>
      ) : null}

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>シフトを割り当て</CardTitle>
          </CardHeader>

          <CardContent>
            <ShiftAssignmentCreateForm />
          </CardContent>
        </Card>
      ) : null}

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

// /shift/assignments/me を認証付きで取得して本人のシフトを描画する非同期 RSC。
async function MyShift() {
  const assignments = await getMyShiftAssignments(null, null)

  if (assignments instanceof Error) {
    return <p className="text-sm text-destructive">自分のシフトの取得に失敗しました</p>
  }

  return <MyShiftAssignments assignments={assignments} />
}

// /shift/patterns を認証付きで取得してパターン一覧を描画する非同期 RSC。
async function Patterns() {
  const patterns = await getShiftPatterns()

  if (patterns instanceof Error) {
    return <p className="text-sm text-destructive">シフトパターンの取得に失敗しました</p>
  }

  return <ShiftPatternList patterns={patterns} />
}

// /shift/assignments を認証付きで取得して横断のシフト割当を描画する非同期 RSC（特権ロール）。
async function AllAssignments() {
  const assignments = await getShiftAssignments({ from: null, to: null, deptCode: null })

  if (assignments instanceof Error) {
    return <p className="text-sm text-destructive">シフト割当一覧の取得に失敗しました</p>
  }

  return <ShiftAssignmentList assignments={assignments} canManage={true} />
}

function ShiftSkeleton() {
  const placeholders = [0, 1, 2]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}
