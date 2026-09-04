import { notFound } from "next/navigation"
import { CreatePostingForm } from "@/app/(app)/my/career/_components/create-posting-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { getMe } from "@/lib/api/get-me"
import { canManageCareerPostings } from "@/lib/career/can-manage-career-postings"

export const metadata = { title: "公募の新規作成" }

/**
 * 社内公募の新規作成ページ（管理ロール専用）。権限不足は notFound() で隠す。
 */
export default async function NewCareerPostingPage() {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageCareerPostings(currentUser.permissions) === false) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="公募の新規作成">
        <BackButton href="/career/job-postings" label="公募一覧に戻る" />
      </PageHeader>

      <Card className="gap-0">
        <div className="p-6">
          <CreatePostingForm />
        </div>
      </Card>
    </div>
  )
}
