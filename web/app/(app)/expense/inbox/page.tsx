import Link from "next/link"
import { Suspense } from "react"
import { ExpenseStatusBadge } from "@/components/expense-status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
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
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">経費の承認 inbox</h1>

        <Button variant="outline" render={<Link href="/expense" />}>
          自分の経費へ
        </Button>
      </div>

      <Suspense fallback={<ExpenseInboxSkeleton />}>
        <ExpenseInboxTable />
      </Suspense>
    </div>
  )
}

// /expenses/inbox を認証付きで取得して承認待ち一覧テーブルを描画する非同期 RSC。
async function ExpenseInboxTable() {
  const expenses = await getExpenseInbox()

  if (expenses instanceof Error) {
    return (
      <p className="text-sm text-destructive">
        承認 inbox の取得に失敗しました（権限がない可能性があります）
      </p>
    )
  }

  if (expenses.length === 0) {
    return <p className="text-sm text-muted-foreground">承認待ちの経費はありません</p>
  }

  return (
    <Table>
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
              <Button size="sm" variant="outline" render={<Link href={`/expense/${expense.id}`} />}>
                審査する
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ExpenseInboxSkeleton() {
  const placeholders = [0, 1, 2, 3, 4]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}
