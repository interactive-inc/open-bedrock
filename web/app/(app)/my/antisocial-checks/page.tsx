import { Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { MyAntisocialChecksSection } from "@/app/(app)/my/antisocial-checks/_components/my-antisocial-checks-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { getMe } from "@/lib/api/get-me"

export const metadata = { title: "反社チェック" }

/**
 * 反社チェックの自分の申請一覧画面。新規申請は /new に分離。
 */
export default async function AntisocialChecksPage() {
  const currentUser = await getMe()

  const canManage =
    currentUser instanceof Error
      ? false
      : currentUser.permissions.includes("antisocial_check:manage")

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="反社チェック">
        {canManage ? (
          <Button
            variant="secondary"
            nativeButton={false}
            render={<Link href="/inbox/antisocial-checks" />}
          >
            判定受信箱
          </Button>
        ) : null}

        <Button nativeButton={false} render={<Link href="/my/antisocial-checks/new" />}>
          <Plus />
          新規申請
        </Button>
      </PageHeader>

      <Suspense fallback={<ListSkeleton rows={4} rowClassName="h-10 w-full" />}>
        <MyAntisocialChecksSection />
      </Suspense>
    </div>
  )
}
