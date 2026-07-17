import { EmployeeCreateForm } from "@/app/(app)/employees/_components/employee-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { getMe } from "@/lib/api/get-me"
import { getPositionList } from "@/lib/api/get-position-list"
import { canCreateEmployee } from "@/lib/employee/can-create-employee"
import { notFound } from "next/navigation"

export const metadata = { title: "従業員登録" }

// 従業員登録画面。フォームは Client Component に切り出し、Server Action で POST /employees する。
export default async function EmployeeNewPage() {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canCreateEmployee(currentUser.permissions) === false) {
    notFound()
  }

  const canAssignRole = currentUser.permissions.includes("employee:assign_role")

  const positions = await getPositionList()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="従業員を登録"
        description="新しい従業員を従業員台帳に登録します。"
        actions={<BackButton href="/employees" label="一覧に戻る" />}
      />

      <Card className="max-w-xl gap-0 p-0">
        <div className="p-6">
          <EmployeeCreateForm
            canAssignRole={canAssignRole}
            positions={positions instanceof Error ? [] : positions}
          />
        </div>
      </Card>
    </div>
  )
}
