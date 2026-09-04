import { OneOnOneCreateForm } from "@/app/(app)/my/oneonones/_components/oneonone-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { getEmployeeDirectory } from "@/lib/api/get-employee-directory"
import { requirePermission } from "@/lib/auth/require-permission"

export const metadata = { title: "1on1 を記録" }

/**
 * 1on1 の新規記録。フォーム単機能のページとして履歴から独立させる。
 */
export default async function NewOneOnOnePage() {
  await requirePermission("oneonone:create")

  const employeeResult = await getEmployeeDirectory()

  const employees =
    employeeResult instanceof Error
      ? []
      : employeeResult.items.flatMap((e) =>
          e.code === null ? [] : [{ code: e.code, name: e.name }],
        )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="1on1 を記録">
        <BackButton href="/my/oneonones" label="履歴に戻る" />
      </PageHeader>

      <Card>
        <CardContent>
          <OneOnOneCreateForm employees={employees} />
        </CardContent>
      </Card>
    </div>
  )
}
