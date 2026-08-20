import { formatDate } from "@/lib/format-date"
import { formatDateTime } from "@/lib/format-date-time"
import { Suspense } from "react"
import { ExpenseDecisionForm } from "@/app/(app)/my/expenses/_components/expense-decision-form"
import { BackButton } from "@/components/back-button"
import { DetailField } from "@/components/detail-field"
import { ExpenseStatusBadge } from "@/components/expense-status-badge"
import { FetchError } from "@/components/fetch-error"
import { PageHeader } from "@/components/page-header"
import { DetailSkeleton } from "@/components/detail-skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getExpenseDetail } from "@/lib/api/get-expense-detail"
import { handleDetailError } from "@/lib/api/handle-detail-error"
import { toExpenseCategoryLabel } from "@/lib/expense/to-expense-category-label"
import { getMe } from "@/lib/api/get-me"
import { canDecideExpense } from "@/lib/expense/can-decide-expense"

export const metadata = { title: "経費詳細" }

type Props = {
  params: Promise<{ expense: string }>
}

const amountFormatter = new Intl.NumberFormat("ja-JP")

/** 経費詳細画面。params.expense で対象を取得し、詳細と承認・却下フォームを描画する RSC。 */
export default async function ExpenseDetailPage(props: Props) {
  const [params, currentUser] = await Promise.all([props.params, getMe()])

  const canDecide = currentUser instanceof Error ? false : canDecideExpense(currentUser.permissions)

  const viewerEmployeeId = currentUser instanceof Error ? null : currentUser.id

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="経費詳細"
        actions={<BackButton href="/my/expenses" label="経費一覧に戻る" />}
      />

      <Suspense fallback={<DetailSkeleton fields={5} />}>
        <ExpenseDetailView
          id={params.expense}
          canDecide={canDecide}
          viewerEmployeeId={viewerEmployeeId}
        />
      </Suspense>
    </div>
  )
}

type ViewProps = {
  id: string
  canDecide: boolean
  viewerEmployeeId: number | null
}

/** /expenses/:id を認証付きで取得して詳細カードと意思決定フォームを描画する非同期 RSC。 */
async function ExpenseDetailView(props: ViewProps) {
  const expenseId = Number(props.id)

  if (!Number.isInteger(expenseId) || expenseId <= 0) {
    return <FetchError message="経費 ID が不正です" />
  }

  const expense = await getExpenseDetail(expenseId)

  if (expense instanceof Error) {
    handleDetailError(expense)
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
            <DetailField label="申請者">{expense.applicant_name}</DetailField>

            <DetailField label="金額">
              <span className="tabular-nums">{amountFormatter.format(expense.amount)} 円</span>
            </DetailField>

            <DetailField label="利用日">{formatDate(expense.spent_at)}</DetailField>

            <DetailField label="申請日">{formatDateTime(expense.created_at)}</DetailField>

            <DetailField label="メモ" span="full">
              <span className="whitespace-pre-wrap">{expense.note ?? "-"}</span>
            </DetailField>

            <DetailField label="領収書" span="full">
              {expense.attachments.length === 0 ? (
                <span>-</span>
              ) : (
                <ul className="flex flex-col gap-1">
                  {expense.attachments.map((attachment) => (
                    <li key={attachment.id}>
                      <a
                        className="underline underline-offset-4"
                        href={`/organization/expenses/${expense.id}/attachments/${attachment.id}`}
                      >
                        {attachment.file_name}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </DetailField>
          </dl>
        </CardContent>
      </Card>

      {isPending && props.canDecide && expense.employee_id !== props.viewerEmployeeId ? (
        <Card>
          <CardHeader>
            <CardTitle>承認・却下</CardTitle>
          </CardHeader>

          <CardContent>
            <ExpenseDecisionForm expenseId={expense.id} />
          </CardContent>
        </Card>
      ) : isPending ? null : (
        <p className="text-sm text-muted-foreground">
          この経費は既に処理済みのため、承認・却下はできません
        </p>
      )}
    </div>
  )
}
