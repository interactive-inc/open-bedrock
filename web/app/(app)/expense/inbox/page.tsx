import { FetchError } from "@/components/fetch-error"
import Link from "next/link"
import { Suspense } from "react"
import { EmptyState } from "@/components/empty-state"
import { ExpenseStatusBadge } from "@/components/expense-status-badge"
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
import { getExpenseInbox } from "@/lib/api/get-expense-inbox"
import { toExpenseCategoryLabel } from "@/lib/expense/to-expense-category-label"

export const metadata = { title: "承認待ちの経費" }

const amountFormatter = new Intl.NumberFormat("ja-JP")

// 経費承認 inbox 画面。承認者向けに承認待ちの経費を RSC で取得し一覧表示する。
export default function ExpenseInboxPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="経費の承認 inbox"
        description="承認待ちの経費申請を確認します。"
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/expense" />}>
            自分の経費へ
          </Button>
        }
      />

      <Suspense fallback={<ListSkeleton rows={5} />}>
        <ExpenseInboxTable />
      </Suspense>
    </div>
  )
}

// /expenses/inbox を認証付きで取得して承認待ち一覧テーブルを描画する非同期 RSC。
async function ExpenseInboxTable() {
  const expenses = await getExpenseInbox()

  if (expenses instanceof Error) {
    return <FetchError message="承認 inbox の取得に失敗しました（権限がない可能性があります）" />
  }

  if (expenses.length === 0) {
    return <EmptyState title="承認待ちの経費はありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>申請者</TableHead>
            <TableHead>カテゴリ</TableHead>
            <TableHead>金額</TableHead>
            <TableHead>利用日</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {expenses.map((expense) => (
            <TableRow key={expense.id}>
              <TableCell className="font-medium">{expense.applicant_name}</TableCell>

              <TableCell>{toExpenseCategoryLabel(expense.category)}</TableCell>

              <TableCell className="tabular-nums">
                {amountFormatter.format(expense.amount)} 円
              </TableCell>

              <TableCell className="text-muted-foreground">{expense.spent_at}</TableCell>

              <TableCell>
                <ExpenseStatusBadge status={expense.status} />
              </TableCell>

              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="outline"
                  render={<Link href={`/expense/${expense.id}`} />}
                >
                  審査する
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
