import { FetchError } from "@/components/fetch-error"
import { formatDate } from "@/lib/format-date"
import Link from "next/link"
import { Suspense } from "react"
import { EmptyState } from "@/components/empty-state"
import { ExpenseStatusBadge } from "@/components/expense-status-badge"
import { ListSkeleton } from "@/components/list-skeleton"
import { SubPageHeader } from "@/components/sub-page-header"
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
import { requirePermission } from "@/lib/auth/require-permission"

export const metadata = { title: "承認待ちの経費" }

const amountFormatter = new Intl.NumberFormat("ja-JP")

/** 経費承認 inbox 画面。承認者向けに承認待ちの経費を RSC で取得し一覧表示する。 */
export default async function ExpenseInboxPage(props: {
  searchParams: Promise<{ offset?: string }>
}) {
  await requirePermission("expense:approve")
  const query = await props.searchParams
  const rawOffset = Number(query.offset ?? 0)
  const offset = Number.isSafeInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0

  return (
    <div className="flex flex-col gap-8">
      <SubPageHeader
        title="承認待ちの経費"
        actions={
          <Button variant="secondary" nativeButton={false} render={<Link href="/my/expenses" />}>
            自分の経費へ
          </Button>
        }
      />

      <Suspense fallback={<ListSkeleton rows={5} />}>
        <ExpenseInboxTable offset={offset} />
      </Suspense>
    </div>
  )
}

/** /expenses/inbox を認証付きで取得して承認待ち一覧テーブルを描画する非同期 RSC。 */
async function ExpenseInboxTable(props: { offset: number }) {
  const page = await getExpenseInbox(props.offset)

  if (page instanceof Error) {
    return <FetchError message="承認 inbox の取得に失敗しました（権限がない可能性があります）" />
  }

  const expenses = page.data

  return (
    <div className="flex flex-col gap-4">
      {expenses.length === 0 ? <EmptyState title="この範囲に承認待ちの経費はありません" /> : null}
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
                <TableCell>{expense.applicant_name}</TableCell>

                <TableCell>{toExpenseCategoryLabel(expense.category)}</TableCell>

                <TableCell className="tabular-nums">
                  {amountFormatter.format(expense.amount)} 円
                </TableCell>

                <TableCell>{formatDate(expense.spent_at)}</TableCell>

                <TableCell>
                  <ExpenseStatusBadge status={expense.status} />
                </TableCell>

                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="secondary"
                    nativeButton={false}
                    render={<Link href={`/expense/expenses/${expense.id}`} />}
                  >
                    審査する
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <nav aria-label="経費受信箱のページ" className="flex gap-4">
        {props.offset > 0 ? <Link href="/inbox/expenses">最初へ</Link> : null}
        {page.next_offset !== null ? (
          <Link href={`/inbox/expenses?offset=${page.next_offset}`}>次へ</Link>
        ) : null}
      </nav>
    </div>
  )
}
