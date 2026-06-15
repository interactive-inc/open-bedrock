import { Suspense } from "react"
import { OrgMembersTable } from "@/app/(app)/org/departments/[code]/_components/org-members-table"
import { BackButton } from "@/components/back-button"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"

export const metadata = { title: "部署メンバー" }

type Props = {
  params: Promise<{ code: string }>
}

// 部署メンバー画面（/org/departments/:code/members）。
// 動的セグメント params は Next.js 16 では Promise なので await して取り出す。
export default async function OrgDepartmentMembersPage(props: Props) {
  const params = await props.params

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`部署メンバー: ${params.code}`}
        actions={<BackButton href="/org" label="組織図に戻る" />}
      />

      <Suspense fallback={<ListSkeleton rows={5} rowClassName="h-10 w-full" />}>
        <OrgMembersTable code={params.code} />
      </Suspense>
    </div>
  )
}
