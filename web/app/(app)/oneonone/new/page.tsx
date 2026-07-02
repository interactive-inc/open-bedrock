import { OneOnOneCreateForm } from "@/app/(app)/oneonone/_components/oneonone-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { getEmployeeList } from "@/lib/api/get-employee-list"

export const metadata = { title: "1on1 を記録" }

/**
 * 1on1 の新規記録。フォーム単機能のページとして履歴から独立させる。
 */
export default async function NewOneOnOnePage() {
  const employeeResult = await getEmployeeList({ q: null, dept: null, status: "active" })

  const employees =
    employeeResult instanceof Error
      ? []
      : employeeResult.items.map((e) => ({ code: e.code, name: e.name }))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="1on1 を記録"
        description="日時・相手・メモを入力して 1on1 を記録します。"
        actions={<BackButton href="/oneonone" label="履歴に戻る" />}
      />

      <Card className="max-w-xl">
        <CardContent>
          <OneOnOneCreateForm employees={employees} />
        </CardContent>
      </Card>
    </div>
  )
}
