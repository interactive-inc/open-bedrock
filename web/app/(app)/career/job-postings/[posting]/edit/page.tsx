import { notFound } from "next/navigation"
import { EditPostingForm } from "@/app/(app)/my/career/_components/edit-posting-form"
import { BackButton } from "@/components/back-button"
import { FetchError } from "@/components/fetch-error"
import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { getCareerPosting } from "@/lib/api/get-career-posting"
import { getMe } from "@/lib/api/get-me"
import { canManageCareerPostings } from "@/lib/career/can-manage-career-postings"

export const metadata = { title: "公募の編集" }

type Props = {
  params: Promise<{ posting: string }>
}

/**
 * 社内公募の編集ページ（管理ロール専用）。権限不足は notFound() で隠す。
 */
export default async function EditCareerPostingPage(props: Props) {
  const params = await props.params

  const postingId = Number(params.posting)

  if (Number.isInteger(postingId) === false || postingId <= 0) {
    notFound()
  }

  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageCareerPostings(currentUser.permissions) === false) {
    notFound()
  }

  const posting = await getCareerPosting(postingId)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="公募の編集"
        actions={<BackButton href={`/career/job-postings/${postingId}`} label="詳細に戻る" />}
      />

      {posting instanceof Error ? (
        <FetchError message="公募の取得に失敗しました" />
      ) : (
        <Card className="p-0 gap-0">
          <div className="p-6">
            <EditPostingForm posting={posting} />
          </div>
        </Card>
      )}
    </div>
  )
}
