import { formatDate } from "@/lib/format-date"
import { formatDateTime } from "@/lib/format-date-time"
import Link from "next/link"
import { EmptyState } from "@/components/empty-state"
import { ExpenseStatusBadge } from "@/components/expense-status-badge"
import { SortableTableHead } from "@/components/sortable-table-head"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toExpenseCategoryLabel } from "@/lib/expense/to-expense-category-label"
import type { ExpenseAdminSort } from "@/lib/api/get-expense-admin-list"
import type { ExpenseCategory, ExpenseStatus } from "@/lib/api/types/expense-types"

const amountFormatter = new Intl.NumberFormat("ja-JP")

export type ExpenseAdminRow = {
  id: number
  applicant_id: string
  applicant_name: string
  applicant_dept_name: string | null
  category: ExpenseCategory
  amount: number
  spent_at: string
  status: ExpenseStatus
  created_at: string
}

type Props = {
  rows: ReadonlyArray<ExpenseAdminRow>
  total: number
  currentSort: ExpenseAdminSort
  extraParams: Record<string, string | undefined>
}

export function ExpenseAdminTable(props: Props) {
  if (props.rows.length === 0) {
    return <EmptyState title="条件に一致する経費申請がありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label={`全社の経費申請 ${props.total} 件`}>
        <TableHeader>
          <TableRow>
            <TableHead>カテゴリ</TableHead>
            <TableHead>申請者</TableHead>
            <TableHead className="hidden md:table-cell">部署</TableHead>
            <SortableTableHead
              pathname="/expense/expenses"
              currentSort={props.currentSort}
              ascValue="amount_asc"
              descValue="amount_desc"
              label="金額"
              extraParams={props.extraParams}
            />
            <TableHead className="hidden md:table-cell">利用日</TableHead>
            <TableHead>ステータス</TableHead>
            <SortableTableHead
              pathname="/expense/expenses"
              currentSort={props.currentSort}
              ascValue="created_at_asc"
              descValue="created_at_desc"
              label="申請日"
              className="hidden md:table-cell"
              extraParams={props.extraParams}
            />
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Link
                  href={`/expense/expenses/${row.id}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {toExpenseCategoryLabel(row.category)}
                </Link>
              </TableCell>

              <TableCell className="text-muted-foreground">
                <Link
                  href={`/expense/expenses?applicant_id=${row.applicant_id}`}
                  className="underline-offset-4 hover:underline"
                  aria-label={`${row.applicant_name} の経費申請で絞り込む`}
                >
                  {row.applicant_name}
                </Link>
              </TableCell>

              <TableCell className="hidden text-muted-foreground md:table-cell">
                {row.applicant_dept_name ?? "—"}
              </TableCell>

              <TableCell className="tabular-nums">
                {amountFormatter.format(row.amount)} 円
              </TableCell>

              <TableCell className="hidden text-muted-foreground md:table-cell">
                {formatDate(row.spent_at)}
              </TableCell>

              <TableCell>
                <ExpenseStatusBadge status={row.status} />
              </TableCell>

              <TableCell className="hidden text-muted-foreground md:table-cell">
                {formatDateTime(row.created_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
