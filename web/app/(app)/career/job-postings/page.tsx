import { Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { CareerPostingsSection } from "@/app/(app)/my/career/_components/career-postings-section"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getMe } from "@/lib/api/get-me"
import { canManageCareerPostings } from "@/lib/career/can-manage-career-postings"

export const metadata = { title: "社内公募" }

const postingSkeletonPlaceholders = [0, 1]

/**
 * 社内公募の一覧。全従業員が閲覧でき、管理ロールは新規作成への導線が出る。
 * 締切の公募は管理ロールのみ表示される。
 */
export default async function CareerPostingsPage() {
  const currentUser = await getMe()

  const canManage =
    currentUser instanceof Error ? false : canManageCareerPostings(currentUser.permissions)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="社内公募">
        <div className="flex items-center gap-2">
          <BackButton href="/my/career" label="キャリアに戻る" />

          {canManage ? (
            <Button nativeButton={false} render={<Link href="/career/job-postings/new" />}>
              <Plus />
              新規作成
            </Button>
          ) : null}
        </div>
      </PageHeader>

      <Suspense fallback={<PostingsSkeleton />}>
        <CareerPostingsSection canManage={canManage} />
      </Suspense>
    </div>
  )
}

function PostingsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {postingSkeletonPlaceholders.map((index) => (
        <Skeleton key={index} className="w-full" />
      ))}
    </div>
  )
}
