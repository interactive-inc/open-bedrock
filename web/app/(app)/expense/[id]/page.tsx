import Link from "next/link"
import { Suspense } from "react"
import { ExpenseStatusBadge } from "@/components/expense-status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getExpenseDetail } from "@/lib/api/get-expense-detail"
import { toExpenseCategoryLabel } from "@/lib/expense/to-expense-category-label"
import { ExpenseDecisionForm } from "@/app/(app)/expense/expense-decision-form"

export const metadata = { title: "経費詳細" }

type Props = {
  params: Promise<{ id: string }>
}

const amountFormatter = new Intl.NumberFormat("ja-JP")

// 経費詳細画面。params.id で対象を取得し、詳細と承認・却下フォームを描画する RSC。
export default async function ExpenseDetailPage(props: Props) {
  const params = await props.params

  return (
    <div className="flex flex-col gap-6">
      <Link href="/expense" className="text-sm text-muted-foreground hover:text-foreground">
        ← 経費一覧へ戻る
      </Link>

      <Suspense fallback={<ExpenseDetailSkeleton />}>
        <ExpenseDetailView id={params.id} />
      </Suspense>
    </div>
  )
}

type ViewProps = {
  id: string
}

// /expenses/:id を認証付きで取得して詳細カードと意思決定フォームを描画する非同期 RSC。
async function ExpenseDetailView(props: ViewProps) {
  const expenseId = Number(props.id)

  if (!Number.isInteger(expenseId) || expenseId <= 0) {
    return <p className="text-sm text-destructive">経費 ID が不正です</p>
  }

  const expense = await getExpenseDetail(expenseId)

  if (expense instanceof Error) {
    return <p className="text-sm text-destructive">経費詳細の取得に失敗しました</p>
  }

  const isPending = expense.status === "pending"

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>{toExpenseCategoryLabel(expense.category)}</CardTitle>

            <ExpenseStatusBadge status={expense.status} />
          </div>
        </CardHeader>

        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <dt className="text-sm text-muted-foreground">申請者</dt>

              <dd className="text-sm font-medium">{expense.applicant_name}</dd>
            </div>

            <div className="flex flex-col gap-1">
              <dt className="text-sm text-muted-foreground">金額</dt>

              <dd className="text-sm font-medium tabular-nums">
                {amountFormatter.format(expense.amount)} 円
              </dd>
            </div>

            <div className="flex flex-col gap-1">
              <dt className="text-sm text-muted-foreground">利用日</dt>

              <dd className="text-sm font-medium">{expense.spent_at}</dd>
            </div>

            <div className="flex flex-col gap-1">
              <dt className="text-sm text-muted-foreground">申請日</dt>

              <dd className="text-sm font-medium">{expense.created_at}</dd>
            </div>

            <div className="flex flex-col gap-1 sm:col-span-2">
              <dt className="text-sm text-muted-foreground">メモ</dt>

              <dd className="text-sm whitespace-pre-wrap">{expense.note ?? "-"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {isPending ? (
        <Card>
          <CardHeader>
            <CardTitle>承認・却下</CardTitle>
          </CardHeader>

          <CardContent>
            <ExpenseDecisionForm expenseId={expense.id} />
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          この経費は既に処理済みのため、承認・却下はできません
        </p>
      )}
    </div>
  )
}

function ExpenseDetailSkeleton() {
  return <Skeleton className="h-64 w-full" />
}
