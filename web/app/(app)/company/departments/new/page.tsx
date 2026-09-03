import { OrgDepartmentCreateForm } from "@/app/(app)/company/departments/_components/org-department-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { requirePermission } from "@/lib/auth/require-permission"

export const metadata = { title: "部署作成" }

/** 部署ノード作成画面。作成後は /company/departments へ redirect する（org:manage が必要）。 */
export default async function OrgDepartmentNewPage() {
  await requirePermission("org:manage")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="部署作成"
        description="新しい部署ノードを作成します。"
        actions={<BackButton href="/company/departments" label="一覧に戻る" />}
      />

      <Card className="max-w-2xl">
        <CardContent>
          <OrgDepartmentCreateForm />
        </CardContent>
      </Card>
    </div>
  )
}
