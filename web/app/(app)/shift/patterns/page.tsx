import { FetchError } from "@/components/fetch-error"
import { Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { ShiftPatternList } from "@/app/(app)/shift/_components/shift-pattern-list"
import { BackButton } from "@/components/back-button"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { getMe } from "@/lib/api/get-me"
import { getShiftPatterns } from "@/lib/api/get-shift-patterns"
import { canManageShift } from "@/lib/shift/can-manage-shift"

export const metadata = { title: "シフトパターン" }

/**
 * シフトパターン一覧。「パターン」というオブジェクトに集中させ、
 * 新規作成は /shift/patterns/new に分離して特権ロールにだけ導線を出す。
 */
export default async function ShiftPatternsPage() {
  const currentUser = await getMe()

  const canManage = currentUser instanceof Error ? false : canManageShift(currentUser.permissions)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="シフトパターン"
        description="シフトの定型パターンを一覧します。"
        actions={
          <>
            <BackButton href="/shift" label="シフトに戻る" />

            {canManage ? (
              <Button nativeButton={false} render={<Link href="/shift/patterns/new" />}>
                <Plus />
                パターンを作成
              </Button>
            ) : null}
          </>
        }
      />

      <Suspense fallback={<ListSkeleton rows={3} />}>
        <Patterns canManage={canManage} />
      </Suspense>
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
