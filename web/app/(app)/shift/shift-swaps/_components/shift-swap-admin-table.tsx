import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/empty-state"
import { SortableTableHead } from "@/components/sortable-table-head"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ShiftSwapAdminSort } from "@/lib/api/get-shift-swap-admin-list"

export type ShiftSwapAdminRow = {
  id: number
  requester_employee_id: string
  requester_employee_code: string
  requester_name: string
  requester_dept_name: string | null
  target_employee_id: string
  target_employee_code: string
  target_name: string
  date: string
  note: string | null
  status: string
  approved_at: string | null
}

type Props = {
  rows: ReadonlyArray<ShiftSwapAdminRow>
  total: number
  currentSort: ShiftSwapAdminSort
  extraParams: Record<string, string | undefined>
}

function StatusBadge(props: { status: string }) {
  if (props.status === "approved") {
    return <Badge className="bg-emerald-600 text-white">承認済み</Badge>
  }

  if (props.status === "rejected") {
    return <Badge variant="destructive">却下</Badge>
  }

  return <Badge variant="secondary">承認待ち</Badge>
}

export function ShiftSwapAdminTable(props: Props) {
  if (props.rows.length === 0) {
    return <EmptyState title="条件に一致する交代申請がありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label={`全社のシフト交代申請 ${props.total} 件`}>
        <TableHeader>
          <TableRow>
            <SortableTableHead
              pathname="/shift/shift-swaps"
              currentSort={props.currentSort}
              ascValue="date_asc"
              descValue="date_desc"
              label="対象日"
              extraParams={props.extraParams}
            />
            <TableHead>申請者</TableHead>
            <TableHead className="hidden md:table-cell">申請者部署</TableHead>
            <TableHead>交代先</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead className="hidden md:table-cell">メモ</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.date}</TableCell>

              <TableCell className="text-muted-foreground">
                <Link
                  href={`/shift/shift-swaps?requester_id=${row.requester_employee_id}`}
                  className="underline-offset-4 hover:underline"
                  aria-label={`${row.requester_name} の申請で絞り込む`}
                >
                  {row.requester_name}
                </Link>
              </TableCell>

              <TableCell className="hidden text-muted-foreground md:table-cell">
                {row.requester_dept_name ?? "—"}
              </TableCell>

              <TableCell className="text-muted-foreground">
                <Link
                  href={`/shift/shift-swaps?target_id=${row.target_employee_id}`}
                  className="underline-offset-4 hover:underline"
                  aria-label={`${row.target_name} が交代先の申請で絞り込む`}
                >
                  {row.target_name}
                </Link>
              </TableCell>

              <TableCell>
                <StatusBadge status={row.status} />
              </TableCell>

              <TableCell className="hidden max-w-xs truncate text-muted-foreground md:table-cell">
                {row.note ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
