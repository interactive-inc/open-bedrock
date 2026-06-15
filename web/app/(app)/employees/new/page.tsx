import { EmployeeCreateForm } from "@/app/(app)/employees/_components/employee-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"

export const metadata = { title: "従業員登録" }

// 従業員登録画面。フォームは Client Component に切り出し、Server Action で POST /employees する。
export default function EmployeeNewPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="従業員を登録"
        description="新しい従業員を従業員台帳に登録します。"
        actions={<BackButton href="/employees" label="一覧に戻る" />}
      />

      <Card className="max-w-xl gap-0 p-0">
        <div className="p-6">
          <EmployeeCreateForm />
        </div>
      </Card>
    </div>
  )
}
