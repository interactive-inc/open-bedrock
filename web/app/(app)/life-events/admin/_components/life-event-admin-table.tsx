import Link from "next/link"
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
  employee_id: number
  event_type: string
  event_date: string
  detail: string | null
  status: string
  created_at: string
}

type Props = {
  rows: ReadonlyArray<Row>
  total: number
}

// 全社のライフイベント届一覧テーブル。詳細は各届出のページへ、従業員 ID クリックで絞り込む。
export function LifeEventAdminTable(props: Props) {
  if (props.rows.length === 0) {
    return <EmptyState title="条件に一致するライフイベント届がありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label={`全社のライフイベント届 ${props.total} 件`}>
        <TableHeader>
          <TableRow>
            <TableHead>種別</TableHead>
            <TableHead>従業員 ID</TableHead>
            <TableHead>発生日</TableHead>
            <TableHead className="hidden md:table-cell">詳細</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead className="hidden md:table-cell">届出日</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Link
                  href={`/life-events/${row.id}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {row.event_type}
                </Link>
              </TableCell>

              <TableCell className="text-muted-foreground">
                <Link
                  href={`/life-events/admin?employee_id=${row.employee_id}`}
                  className="underline-offset-4 hover:underline"
                  aria-label={`従業員 ${row.employee_id} のライフイベント届で絞り込む`}
                >
                  {row.employee_id}
                </Link>
              </TableCell>

              <TableCell className="text-muted-foreground">{row.event_date}</TableCell>

              <TableCell className="hidden text-muted-foreground md:table-cell">
                {row.detail ?? "—"}
              </TableCell>

              <TableCell>{statusLabel(row.status)}</TableCell>

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
