import { FetchError } from "@/components/fetch-error"
import { formatDate } from "@/lib/format-datetime"
import { Plus, TrendingUp } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { EmptyState } from "@/components/empty-state"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getBudgetList } from "@/lib/api/get-budget-list"
import { requirePermission } from "@/lib/auth/require-permission"

export const metadata = { title: "予算" }

const amountFormatter = new Intl.NumberFormat("ja-JP")

/**
 * 部署予算の一覧画面。予算という記録のオブジェクト一覧に集中させ、
 * 新規登録は /budgets/new、消化状況の横断ビューは /budgets/summary に分離する。
 */
export default async function BudgetsPage() {
  await requirePermission("budget:manage")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="予算"
        description="部署・会計期間ごとの予算の記録"
        actions={
          <>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/organization/budgets/summary" />}
            >
              <TrendingUp />
              消化状況
            </Button>

            <Button nativeButton={false} render={<Link href="/organization/budgets/new" />}>
              <Plus />
              新しい予算
            </Button>
          </>
        }
      />

      <Suspense fallback={<ListSkeleton rows={5} />}>
        <BudgetsTable />
      </Suspense>
    </div>
  )
}

/** GET /budgets を認証付きで取得して一覧テーブルを描画する非同期 RSC。 */
async function BudgetsTable() {
  const budgets = await getBudgetList({ departmentId: null, fiscalPeriod: null })

  if (budgets instanceof Error) {
    return <FetchError message="予算一覧の取得に失敗しました" />
  }

  if (budgets.length === 0) {
    return (
      <EmptyState
        title="登録済みの予算はまだありません"
        description="右上の「新しい予算」から最初の予算を登録できます"
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>名称</TableHead>
            <TableHead>部署</TableHead>
            <TableHead>会計期間</TableHead>
            <TableHead>期間</TableHead>
            <TableHead>予算額</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {budgets.map((budget) => (
            <TableRow key={budget.id}>
              <TableCell>
                <Link
                  href={`/organization/budgets/${budget.id}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {budget.name}
                </Link>
              </TableCell>

              <TableCell className="text-muted-foreground">
                {budget.department_name ?? `#${budget.department_id}`}
              </TableCell>

              <TableCell className="text-muted-foreground">{budget.fiscal_period}</TableCell>

              <TableCell className="text-muted-foreground">
                {formatDate(budget.period_start)} 〜 {formatDate(budget.period_end)}
              </TableCell>

              <TableCell className="tabular-nums">
                {amountFormatter.format(budget.amount)} 円
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
