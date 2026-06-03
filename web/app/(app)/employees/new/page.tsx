import Link from "next/link"
import { EmployeeCreateForm } from "@/app/(app)/employees/employee-create-form"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export const metadata = { title: "従業員登録" }

// 従業員登録画面。フォームは Client Component に切り出し、Server Action で POST /employees する。
export default function EmployeeNewPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">従業員を登録</h1>

        <Button variant="outline" render={<Link href="/employees" />}>
          一覧へ戻る
        </Button>
      </div>

      <Card className="max-w-xl gap-0 p-0">
        <div className="p-6">
          <EmployeeCreateForm />
        </div>
      </Card>
    </div>
  )
}
