import Link from "next/link"
import { Suspense } from "react"
import { ExpenseStatusBadge } from "@/components/expense-status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getMyExpenses } from "@/lib/api/get-my-expenses"
import { toExpenseCategoryLabel } from "@/lib/expense/to-expense-category-label"
import { ExpenseCreateForm } from "@/app/(app)/expense/_components/expense-create-form"

export const metadata = { title: "経費" }

const amountFormatter = new Intl.NumberFormat("ja-JP")

// 自分の経費一覧画面。RSC でサーバ取得し、テーブル表示する。申請フォームも併設。
export default function MyExpensesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">経費</h1>

        <Button variant="outline" render={<Link href="/expense/inbox" />}>
          承認 inbox
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Suspense fallback={<MyExpensesSkeleton />}>
          <MyExpensesTable />
        </Suspense>

        <Card>
          <CardHeader>
            <CardTitle>経費を申請</CardTitle>
          </CardHeader>

          <CardContent>
            <ExpenseCreateForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// /expenses/me を認証付きで取得して一覧テーブルを描画する非同期 RSC。
async function MyExpensesTable() {
  const expenses = await getMyExpenses(null)

  if (expenses instanceof Error) {
    return <p className="text-sm text-destructive">経費一覧の取得に失敗しました</p>
  }

  if (expenses.length === 0) {
    return <p className="text-sm text-muted-foreground">申請済みの経費はまだありません</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>カテゴリ</TableHead>
          <TableHead>金額</TableHead>
          <TableHead>利用日</TableHead>
          <TableHead>ステータス</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {expenses.map((expense) => (
          <TableRow key={expense.id}>
            <TableCell>
              <Link
                href={`/expense/${expense.id}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {toExpenseCategoryLabel(expense.category)}
              </Link>
            </TableCell>

            <TableCell className="tabular-nums">
              {amountFormatter.format(expense.amount)} 円
            </TableCell>

            <TableCell className="text-muted-foreground">{expense.spent_at}</TableCell>

            <TableCell>
              <ExpenseStatusBadge status={expense.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function MyExpensesSkeleton() {
  const placeholders = [0, 1, 2, 3, 4]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}
