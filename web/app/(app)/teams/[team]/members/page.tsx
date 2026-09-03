import { Suspense } from "react"
import { DepartmentName } from "@/app/(app)/teams/[team]/_components/department-name"
import { OrgMembersTable } from "@/app/(app)/teams/[team]/_components/org-members-table"
import { TeamMemberAddForm } from "@/app/(app)/teams/[team]/_components/team-member-add-form"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { getPositionList } from "@/lib/api/get-position-list"
import { requireAuth } from "@/lib/auth/require-auth"

export const metadata = { title: "メンバー" }

type Props = {
  params: Promise<{ team: string }>
}

/**
 * 部署メンバー画面（部署ハブのメンバータブ）。
 * 直接発令の権限を持つ利用者は、この部署を対象にした配属（主配属・兼務）をここから登録できる。
 */
export default async function OrgDepartmentMembersPage(props: Props) {
  const params = await props.params

  const me = await requireAuth()

  const canApply = me.permissions.includes("employee:lifecycle:apply")

  const positions = canApply ? await getPositionList() : null

  const addForm = canApply ? (
    <TeamMemberAddForm
      teamCode={params.team}
      positions={positions === null || positions instanceof Error ? [] : positions}
    />
  ) : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="メンバー" actions={addForm} />

      <DepartmentName team={params.team} />

      <Suspense fallback={<ListSkeleton rows={5} rowClassName="h-10 w-full" />}>
        <OrgMembersTable code={params.team} />
      </Suspense>
    </div>
  )
}
