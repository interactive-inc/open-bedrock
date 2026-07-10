import { Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { MyAntisocialChecksSection } from "@/app/(app)/antisocial-checks/_components/my-antisocial-checks-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { getMe } from "@/lib/api/get-me"

export const metadata = { title: "反社チェック申請" }

/**
 * 反社チェック申請の自分の申請一覧画面。新規申請は /new に分離。
 */
export default async function AntisocialChecksPage() {
  const currentUser = await getMe()

  const canManage =
    currentUser instanceof Error
      ? false
      : currentUser.permissions.includes("antisocial_check:manage")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="反社チェック申請"
        description="反社チェックの申請と、申請状況を確認します。"
        actions={
          <>
            {canManage ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/antisocial-checks/admin" />}
              >
                判定受信箱
              </Button>
            ) : null}

            <Button nativeButton={false} render={<Link href="/antisocial-checks/new" />}>
              <Plus />
              新規申請
            </Button>
          </>
        }
      />

      <Suspense fallback={<ListSkeleton rows={4} rowClassName="h-10 w-full" />}>
        <MyAntisocialChecksSection />
      </Suspense>
    </div>
  )
}
