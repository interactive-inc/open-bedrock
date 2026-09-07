import { ExpenseResubmission } from "@/app/(app)/expense/expenses/_components/expense-resubmission"
import { ExpenseProcedureControls } from "@/app/(app)/expense/expenses/_components/expense-procedure-controls"
import { ExpenseDecisionHistory } from "@/app/(app)/expense/expenses/_components/expense-decision-history"
import Link from "next/link"
import { formatDate } from "@/lib/format-date"
import { formatDateTime } from "@/lib/format-date-time"
import { Suspense } from "react"
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

export const metadata = { title: "経費詳細" }

type Props = {
  params: Promise<{ expense: string }>
}

const amountFormatter = new Intl.NumberFormat("ja-JP")

/** 経費詳細画面。params.expense で対象を取得し、詳細と承認・却下フォームを描画する RSC。 */
export default async function ExpenseDetailPage(props: Props) {
  const params = await props.params

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="経費詳細">
        <BackButton href="/my/expenses" label="経費一覧に戻る" />
      </PageHeader>

      <Suspense fallback={<DetailSkeleton fields={5} />}>
        <ExpenseDetailView id={params.expense} />
      </Suspense>
    </div>
  )
}

type ViewProps = {
  id: string
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

  const requestKey = crypto.randomUUID()

  return (
    <div className="flex flex-col gap-8">
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
            <DetailField label="負担組織">
              {expense.organization_unit_name ?? expense.organization_unit_id}
            </DetailField>
            {expense.required_approvals !== null ? (
              <DetailField label="現在の段階の承認">
                {expense.approvals} / {expense.required_approvals} 名
              </DetailField>
            ) : null}

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
                <ul className="flex flex-col gap-2">
                  {expense.attachments.map((attachment) => (
                    <li key={attachment.id}>
                      <a
                        className="underline underline-offset-4"
                        href={`/expense/expenses/${expense.id}/attachments/${attachment.id}`}
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

      {expense.procedure_required ? (
        <p>
          この経費は現在の承認規程へ未接続です。本人が内容と添付を確認して接続すると、番号と履歴を保ったまま審査を開始します。
        </p>
      ) : null}
      {!expense.evidence_available ? (
        <p role="alert">確認した領収書を利用できないため、判断・決裁確定を停止しています。</p>
      ) : null}
      <ExpenseProcedureControls expense={expense} />
      <ExpenseResubmission expense={expense} requestKey={requestKey} />
      {expense.previous_expense_id !== null ? (
        <Link href={`/expense/expenses/${expense.previous_expense_id}`}>差戻し元の経費を見る</Link>
      ) : null}
      {expense.next_expense_id !== null ? (
        <Link href={`/expense/expenses/${expense.next_expense_id}`}>
          修正して再提出した経費を見る
        </Link>
      ) : null}
      <ExpenseDecisionHistory decisions={expense.decisions} />
    </div>
  )
}
