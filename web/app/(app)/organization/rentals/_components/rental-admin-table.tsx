import Link from "next/link"
import { RentalAdminActions } from "@/app/(app)/organization/rentals/_components/rental-admin-actions"
import { EmptyState } from "@/components/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDateTime } from "@/lib/format-datetime"
import { statusLabel } from "@/lib/status-label"

type Row = {
  id: string
  requester_id: number
  item_name: string
  start_date: string
  end_date: string
  purpose: string | null
  status: string
  created_at: string
}

type Props = {
  rows: ReadonlyArray<Row>
  total: number
  canManage: boolean
}

/** 全社の貸与品予約一覧テーブル。詳細は各予約のページへ、申請者 ID クリックで絞り込む。 */
export function RentalAdminTable(props: Props) {
  if (props.rows.length === 0) {
    return <EmptyState title="条件に一致する貸与品予約がありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label={`全社の貸与品予約 ${props.total} 件`}>
        <TableHeader>
          <TableRow>
            <TableHead>貸与品</TableHead>
            <TableHead>申請者 ID</TableHead>
            <TableHead>期間</TableHead>
            <TableHead className="hidden md:table-cell">用途</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead className="hidden md:table-cell">申請日</TableHead>
            {props.canManage ? <TableHead>操作</TableHead> : null}
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <span className="font-medium">{row.item_name}</span>
              </TableCell>

              <TableCell className="text-muted-foreground">
                <Link
                  href={`/organization/rentals?employee_id=${row.requester_id}`}
                  className="underline-offset-4 hover:underline"
                  aria-label={`従業員 ${row.requester_id} の貸与品予約で絞り込む`}
                >
                  {row.requester_id}
                </Link>
              </TableCell>

              <TableCell className="text-muted-foreground">
                {row.start_date === row.end_date
                  ? row.start_date
                  : `${row.start_date} 〜 ${row.end_date}`}
              </TableCell>

              <TableCell className="hidden text-muted-foreground md:table-cell">
                {row.purpose ?? "—"}
              </TableCell>

              <TableCell>{statusLabel(row.status)}</TableCell>

              <TableCell className="hidden text-muted-foreground md:table-cell">
                {formatDateTime(row.created_at)}
              </TableCell>

              {props.canManage ? (
                <TableCell>
                  <RentalAdminActions reservationId={row.id} status={row.status} />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
