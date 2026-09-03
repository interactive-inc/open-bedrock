import Link from "next/link"
import { BusinessTripAdminActions } from "@/app/(app)/business-trip/business-trips/_components/business-trip-admin-actions"
import { EmptyState } from "@/components/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDateTime } from "@/lib/format-date-time"
import { statusLabel } from "@/lib/status-label"

type Row = {
  id: string
  traveler_id: string
  destination: string
  start_date: string
  end_date: string
  purpose: string
  estimated_cost: number | null
  status: string
  created_at: string
}

type Props = {
  rows: ReadonlyArray<Row>
  total: number
  canManage: boolean
}

/** 全社の出張申請一覧テーブル。詳細は各申請のページへ、出張者 ID クリックで絞り込む。 */
export function BusinessTripAdminTable(props: Props) {
  if (props.rows.length === 0) {
    return <EmptyState title="条件に一致する出張申請がありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label={`全社の出張申請 ${props.total} 件`}>
        <TableHeader>
          <TableRow>
            <TableHead>行き先</TableHead>
            <TableHead>出張者 ID</TableHead>
            <TableHead>期間</TableHead>
            <TableHead className="hidden md:table-cell">概算費用</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead className="hidden md:table-cell">申請日</TableHead>
            {props.canManage ? <TableHead>操作</TableHead> : null}
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <span className="font-medium">{row.destination}</span>
              </TableCell>

              <TableCell className="text-muted-foreground">
                <Link
                  href={`/business-trip/business-trips?employee_id=${row.traveler_id}`}
                  className="underline-offset-4 hover:underline"
                  aria-label={`従業員 ${row.traveler_id} の出張申請で絞り込む`}
                >
                  {row.traveler_id}
                </Link>
              </TableCell>

              <TableCell className="text-muted-foreground">
                {row.start_date === row.end_date
                  ? row.start_date
                  : `${row.start_date} 〜 ${row.end_date}`}
              </TableCell>

              <TableCell className="hidden tabular-nums md:table-cell">
                {row.estimated_cost !== null
                  ? `¥${row.estimated_cost.toLocaleString("ja-JP")}`
                  : "—"}
              </TableCell>

              <TableCell>{statusLabel(row.status)}</TableCell>

              <TableCell className="hidden text-muted-foreground md:table-cell">
                {formatDateTime(row.created_at)}
              </TableCell>

              {props.canManage ? (
                <TableCell>
                  {row.status === "requested" ? (
                    <BusinessTripAdminActions businessTripId={row.id} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
