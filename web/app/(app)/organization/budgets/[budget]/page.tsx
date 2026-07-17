import { formatDate, formatDateTime } from "@/lib/format-datetime"
import { Suspense } from "react"
import { BudgetDeleteButton } from "@/app/(app)/organization/budgets/_components/budget-delete-button"
import { BudgetEditForm } from "@/app/(app)/organization/budgets/_components/budget-edit-form"
import { BackButton } from "@/components/back-button"
import { DetailField } from "@/components/detail-field"
import { FetchError } from "@/components/fetch-error"
import { PageHeader } from "@/components/page-header"
import { DetailSkeleton } from "@/components/detail-skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getBudgetDetail } from "@/lib/api/get-budget-detail"
import { handleDetailError } from "@/lib/api/handle-detail-error"
import { requirePermission } from "@/lib/auth/require-permission"

export const metadata = { title: "予算詳細" }

type Props = {
  params: Promise<{ budget: string }>
}

const amountFormatter = new Intl.NumberFormat("ja-JP")

// 予算詳細画面。params.budget で対象を取得し、消化状況・編集・削除を描画する RSC。
export default async function BudgetDetailPage(props: Props) {
  await requirePermission("budget:manage")

  const params = await props.params

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="予算詳細"
        actions={<BackButton href="/organization/budgets" label="予算一覧に戻る" />}
      />

      <Suspense fallback={<DetailSkeleton fields={6} />}>
        <BudgetDetailView id={params.budget} />
      </Suspense>
    </div>
  )
}

type ViewProps = {
  id: string
}

// /budgets/:id を認証付きで取得して詳細カードと消化状況を描画する非同期 RSC。
async function BudgetDetailView(props: ViewProps) {
  const budgetId = Number(props.id)

  if (!Number.isInteger(budgetId) || budgetId <= 0) {
    return <FetchError message="予算 ID が不正です" />
  }

  const budget = await getBudgetDetail(budgetId)

  if (budget instanceof Error) {
    handleDetailError(budget)
  }

  const consumptionRate =
    budget.amount > 0 ? Math.round((budget.consumed_amount / budget.amount) * 100) : 0

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>{budget.name}</CardTitle>

            <div className="flex items-center gap-2">
              <BudgetEditForm
                budgetId={budget.id}
                amount={budget.amount}
                name={budget.name}
                note={budget.note}
              />

              <BudgetDeleteButton budgetId={budget.id} />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailField label="部署">
              {budget.department_name ?? `#${budget.department_id}`}
            </DetailField>

            <DetailField label="会計期間">{budget.fiscal_period}</DetailField>

            <DetailField label="期間">
              {formatDate(budget.period_start)} 〜 {formatDate(budget.period_end)}
            </DetailField>

            <DetailField label="登録日">{formatDateTime(budget.created_at)}</DetailField>

            <DetailField label="メモ" span="full">
              <span className="whitespace-pre-wrap">{budget.note ?? "-"}</span>
            </DetailField>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>消化状況</CardTitle>
        </CardHeader>

        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-3">
            <DetailField label="予算額">
              <span className="tabular-nums">{amountFormatter.format(budget.amount)} 円</span>
            </DetailField>

            <DetailField label="消化額">
              <span className="tabular-nums">
                {amountFormatter.format(budget.consumed_amount)} 円（{consumptionRate}%）
              </span>
            </DetailField>

            <DetailField label="残額">
              <span className="tabular-nums">
                {amountFormatter.format(budget.remaining_amount)} 円
              </span>
            </DetailField>
          </dl>

          <p className="mt-4 text-sm text-muted-foreground">
            消化額は、この部署の従業員が期間内に利用した承認済み経費の合計です。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
