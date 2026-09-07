import Link from "next/link"
import { EmptyState } from "@/components/empty-state"
import { ExpenseStatusBadge } from "@/components/expense-status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ExpenseMineResponse } from "@/lib/api/types/expense-types"
import { toExpenseCategoryLabel } from "@/lib/expense/to-expense-category-label"

const amountFormatter = new Intl.NumberFormat("ja-JP")

type Props = {
  expenses: ReadonlyArray<ExpenseMineResponse>
}

/** 自分の経費一覧。状態と詳細への導線を表示する。 */
export function MyExpensesList(props: Props) {
  if (props.expenses.length === 0) {
    return <EmptyState title="申請済みの経費はまだありません" />
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

            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.expenses.map((expense) => (
            <TableRow key={expense.id}>
              <TableCell>
                <Link
                  href={`/expense/expenses/${expense.id}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {toExpenseCategoryLabel(expense.category)}
                </Link>
              </TableCell>

              <TableCell className="tabular-nums">
                {amountFormatter.format(expense.amount)} 円
              </TableCell>

              <TableCell>{expense.spent_at}</TableCell>

              <TableCell>
                <ExpenseStatusBadge status={expense.status} />
              </TableCell>

              <TableCell>
                <Link href={`/expense/expenses/${expense.id}`}>詳細・手続き</Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
