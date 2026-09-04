import { ExpenseCreateForm } from "@/app/(app)/my/expenses/_components/expense-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"

export const metadata = { title: "経費の新規申請" }

/**
 * 経費の新規申請。フォーム単機能のページとして、一覧から独立させる。
 */
export default function NewExpensePage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="経費を申請">
        <BackButton href="/my/expenses" label="一覧に戻る" />
      </PageHeader>

      <Card>
        <CardContent>
          <ExpenseCreateForm />
        </CardContent>
      </Card>
    </div>
  )
}
