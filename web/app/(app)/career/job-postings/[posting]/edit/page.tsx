import { toEntityId } from "@/lib/form/to-entity-id"
import { notFound } from "next/navigation"
import { EditPostingForm } from "@/app/(app)/my/career/_components/edit-posting-form"
import { BackButton } from "@/components/back-button"
import { FetchError } from "@/components/fetch-error"
import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { getCareerPosting } from "@/lib/api/get-career-posting"
import { getMe } from "@/lib/api/get-me"
import { listOrgDepartments } from "@/lib/api/list-org-departments"
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

  const postingId = toEntityId(params.posting)

  if (postingId === null) {
    notFound()
  }

  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageCareerPostings(currentUser.permissions) === false) {
    notFound()
  }

  const [posting, departments] = await Promise.all([
    getCareerPosting(postingId),
    listOrgDepartments(),
  ])

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="公募の編集">
        <BackButton href={`/career/job-postings/${postingId}`} label="詳細に戻る" />
      </PageHeader>

      {posting instanceof Error ? (
        <FetchError message="公募の取得に失敗しました" />
      ) : departments instanceof Error ? (
        <FetchError message="部署一覧の取得に失敗しました" />
      ) : (
        <Card className="gap-0">
          <div className="p-8">
            <EditPostingForm
              posting={posting}
              organizationUnits={departments.map((department) => ({
                id: department.id,
                name: department.name,
              }))}
            />
          </div>
        </Card>
      )}
    </div>
  )
}
