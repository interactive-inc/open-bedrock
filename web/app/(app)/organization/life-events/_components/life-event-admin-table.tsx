import Link from "next/link"
import { LifeEventAdminActions } from "@/app/(app)/organization/life-events/_components/life-event-admin-actions"
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
import { lifeEventTypeLabel } from "@/lib/life-event-type-label"
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
  canManage: boolean
}

/** 全社のライフイベント届一覧テーブル。詳細は各届出のページへ、従業員 ID クリックで絞り込む。 */
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
            {props.canManage ? <TableHead>操作</TableHead> : null}
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <span className="font-medium">{lifeEventTypeLabel(row.event_type)}</span>
              </TableCell>

              <TableCell className="text-muted-foreground">
                <Link
                  href={`/organization/life-events?employee_id=${row.employee_id}`}
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

              {props.canManage ? (
                <TableCell>
                  {row.status === "submitted" ? (
                    <LifeEventAdminActions lifeEventId={row.id} />
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
