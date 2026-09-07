import Link from "next/link"
import { getExpenseProcedure } from "@/lib/api/get-expense-procedure"
import { FetchError } from "@/components/fetch-error"
import { ExpenseCreateForm } from "@/app/(app)/my/expenses/_components/expense-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"

export const metadata = { title: "経費の新規起案" }

/**
 * 経費の新規起案。フォーム単機能のページとして、一覧から独立させる。
 */
export default async function NewExpensePage() {
  const procedure = await getExpenseProcedure()
  if (procedure instanceof Error) return <FetchError message={procedure.message} />
  if (procedure.workflow === null)
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="経費の承認規程が未設定です" />
        <p>承認規程の設定後に経費を提出できます。</p>
        <Link href="/expense/procedure">承認規程の設定へ</Link>
      </div>
    )
  const requestKey = crypto.randomUUID()
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="経費を起案">
        <BackButton href="/my/expenses" label="一覧に戻る" />
      </PageHeader>

      <Card>
        <CardContent>
          <ExpenseCreateForm requestKey={requestKey} />
        </CardContent>
      </Card>
    </div>
  )
}
