import { BudgetCreateForm } from "@/app/(app)/budgets/_components/budget-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"

export const metadata = { title: "予算の新規登録" }

/**
 * 予算の新規登録。フォーム単機能のページとして、一覧から独立させる。
 */
export default function NewBudgetPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="予算を登録"
        description="部署・会計期間・期間・金額・名称・任意のメモを入力する"
        actions={<BackButton href="/budgets" label="一覧に戻る" />}
      />

      <Card className="max-w-xl">
        <CardContent>
          <BudgetCreateForm />
        </CardContent>
      </Card>
    </div>
  )
}
