import { ExpenseCreateForm } from "@/app/(app)/expense/_components/expense-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"

export const metadata = { title: "経費の新規申請" }

/**
 * 経費の新規申請。フォーム単機能のページとして、一覧から独立させる。
 */
export default function NewExpensePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="経費を申請"
        description="カテゴリ・金額・利用日・任意のメモを入力する"
        actions={<BackButton href="/expense" label="一覧に戻る" />}
      />

      <Card className="max-w-xl">
        <CardContent>
          <ExpenseCreateForm />
        </CardContent>
      </Card>
    </div>
  )
}
