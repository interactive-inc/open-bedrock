import { FetchError } from "@/components/fetch-error"
import { formatDate } from "@/lib/format-datetime"
import { Inbox, Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { ExpenseStatusBadge } from "@/components/expense-status-badge"
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
import { getMe } from "@/lib/api/get-me"
import { getMyExpenses } from "@/lib/api/get-my-expenses"
import { canViewAllExpenses } from "@/lib/expense/can-view-all-expenses"
import { toExpenseCategoryLabel } from "@/lib/expense/to-expense-category-label"

export const metadata = { title: "経費" }

const amountFormatter = new Intl.NumberFormat("ja-JP")

/**
 * 自分の経費一覧画面。「経費」というオブジェクト一覧に集中させ、
 * 新規作成は /expense/new、承認受信箱は /expense/inbox に分離する。
 */
export default async function MyExpensesPage() {
  const currentUser = await getMe()

  const canViewAll =
    currentUser instanceof Error ? false : canViewAllExpenses(currentUser.permissions)

  const canApprove =
    currentUser instanceof Error ? false : currentUser.permissions.includes("expense:approve")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="経費"
        description="自分が申請した経費の一覧と状態"
        actions={
          <>
            {canViewAll ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/organization/expenses" />}
              >
                経費申請管理
              </Button>
            ) : null}

            {canApprove ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/inbox/expenses" />}
              >
                <Inbox />
                承認受信箱
              </Button>
            ) : null}

            <Button nativeButton={false} render={<Link href="/my/expenses/new" />}>
              <Plus />
              新しい経費
            </Button>
          </>
        }
      />

      <Suspense fallback={<ListSkeleton rows={5} />}>
        <MyExpensesTable />
      </Suspense>
    </div>
  )
}

// /expenses/me を認証付きで取得して一覧テーブルを描画する非同期 RSC。
async function MyExpensesTable() {
  const expenses = await getMyExpenses(null)

  if (expenses instanceof Error) {
    return <FetchError message="経費一覧の取得に失敗しました" />
  }

  if (expenses.length === 0) {
    return (
      <EmptyState
        title="申請済みの経費はまだありません"
        description="右上の「新しい経費」から最初の経費を登録できます"
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
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
                  href={`/organization/expenses/${expense.id}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {toExpenseCategoryLabel(expense.category)}
                </Link>
              </TableCell>

              <TableCell className="tabular-nums">
                {amountFormatter.format(expense.amount)} 円
              </TableCell>

              <TableCell className="text-muted-foreground">
                {formatDate(expense.spent_at)}
              </TableCell>

              <TableCell>
                <ExpenseStatusBadge status={expense.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
