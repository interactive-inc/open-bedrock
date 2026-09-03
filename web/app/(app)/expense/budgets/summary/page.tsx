import { FetchError } from "@/components/fetch-error"
import { Suspense } from "react"
import { BudgetSummaryFilterForm } from "@/app/(app)/expense/budgets/summary/_components/budget-summary-filter-form"
import { BackButton } from "@/components/back-button"
import { EmptyState } from "@/components/empty-state"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getBudgetSummary } from "@/lib/api/get-budget-summary"
import { requirePermission } from "@/lib/auth/require-permission"

export const metadata = { title: "予算の消化状況" }

type Props = {
  searchParams: Promise<{ fiscal_period?: string }>
}

const amountFormatter = new Intl.NumberFormat("ja-JP")

/**
 * 部署ごとの予算・消化額・残額を横断で見る消化状況ビュー。会計期間を指定して集計する。
 */
export default async function BudgetSummaryPage(props: Props) {
  await requirePermission("budget:manage")

  const searchParams = await props.searchParams

  const fiscalPeriod = searchParams.fiscal_period ?? ""

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="消化状況"
        actions={<BackButton href="/expense/budgets" label="予算一覧に戻る" />}
      />

      <BudgetSummaryFilterForm fiscalPeriodValue={fiscalPeriod} />

      {fiscalPeriod === "" ? (
        <EmptyState
          title="会計期間を指定してください"
          description="上のフォームに会計期間を入力すると、部署ごとの消化状況を集計します"
        />
      ) : (
        <Suspense fallback={<ListSkeleton rows={5} />}>
          <BudgetSummaryTable fiscalPeriod={fiscalPeriod} />
        </Suspense>
      )}
    </div>
  )
}

type TableProps = {
  fiscalPeriod: string
}

/** GET /department-budgets/summary を認証付きで取得して部署ごとの消化状況テーブルを描画する非同期 RSC。 */
async function BudgetSummaryTable(props: TableProps) {
  const rows = await getBudgetSummary(props.fiscalPeriod)

  if (rows instanceof Error) {
    return <FetchError message="消化状況の取得に失敗しました" />
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="この会計期間の予算はありません"
        description="別の会計期間を指定するか、予算を登録してください"
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="消化状況">
        <TableHeader>
          <TableRow>
            <TableHead>部署</TableHead>
            <TableHead>予算額</TableHead>
            <TableHead>消化額</TableHead>
            <TableHead>残額</TableHead>
            <TableHead>消化率</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.organization_unit_id}>
              <TableCell>{row.organization_unit_name ?? row.organization_unit_id}</TableCell>

              <TableCell className="tabular-nums">
                {amountFormatter.format(row.budget_amount)} 円
              </TableCell>

              <TableCell className="tabular-nums">
                {amountFormatter.format(row.consumed_amount)} 円
              </TableCell>

              <TableCell className="tabular-nums">
                {amountFormatter.format(row.remaining_amount)} 円
              </TableCell>

              <TableCell className="tabular-nums">
                {row.budget_amount > 0
                  ? Math.round((row.consumed_amount / row.budget_amount) * 100)
                  : 0}
                %
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
