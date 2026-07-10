import { Pencil } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { CareerPostingDetailSection } from "@/app/(app)/career/_components/career-posting-detail-section"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getMe } from "@/lib/api/get-me"
import { canManageCareerPostings } from "@/lib/career/can-manage-career-postings"

export const metadata = { title: "公募の詳細" }

type Props = {
  params: Promise<{ id: string }>
}

/**
 * 1 件の社内公募の詳細ページ。本人は応募フォーム、管理ロールは変更・削除操作を行える。
 */
export default async function CareerPostingDetailPage(props: Props) {
  const params = await props.params

  const postingId = Number(params.id)

  if (Number.isInteger(postingId) === false || postingId <= 0) {
    notFound()
  }

  const currentUser = await getMe()

  const canManage =
    currentUser instanceof Error ? false : canManageCareerPostings(currentUser.permissions)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="公募の詳細"
        description="公募の内容を確認して応募できます。"
        actions={
          <div className="flex items-center gap-2">
            <BackButton href="/career/postings" label="公募一覧に戻る" />

            {canManage ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={`/career/postings/${postingId}/edit`} />}
              >
                <Pencil />
                編集
              </Button>
            ) : null}
          </div>
        }
      />

      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <CareerPostingDetailSection postingId={postingId} canManage={canManage} />
      </Suspense>
    </div>
  )
}
