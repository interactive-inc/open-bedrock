import { BudgetCreateForm } from "@/app/(app)/expense/budgets/_components/budget-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { requirePermission } from "@/lib/auth/require-permission"

export const metadata = { title: "予算の新規登録" }

/**
 * 予算の新規登録。フォーム単機能のページとして、一覧から独立させる。
 */
export default async function NewBudgetPage() {
  await requirePermission("budget:manage")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="予算を登録">
        <BackButton href="/expense/budgets" label="一覧に戻る" />
      </PageHeader>

      <Card>
        <CardContent>
          <BudgetCreateForm />
        </CardContent>
      </Card>
    </div>
  )
}
