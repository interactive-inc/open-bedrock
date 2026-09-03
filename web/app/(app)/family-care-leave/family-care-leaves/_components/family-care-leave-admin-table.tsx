import Link from "next/link"
import { FamilyCareLeaveAdminActions } from "@/app/(app)/family-care-leave/family-care-leaves/_components/family-care-leave-admin-actions"
import { EmptyState } from "@/components/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { familyCareLeaveKindLabel } from "@/lib/family-care-leave-kind-label"
import { formatDateTime } from "@/lib/format-date-time"
import { statusLabel } from "@/lib/status-label"

type Row = {
  id: string
  employee_id: string
  leave_kind: string
  start_date: string
  end_date: string
  note: string | null
  status: string
  created_at: string
}

type Props = {
  rows: ReadonlyArray<Row>
  total: number
  canManage: boolean
}

/** 全社の産休・育休・介護休業の申出一覧テーブル。詳細は各申出のページへ、従業員 ID クリックで絞り込む。 */
export function FamilyCareLeaveAdminTable(props: Props) {
  if (props.rows.length === 0) {
    return <EmptyState title="条件に一致する申出がありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label={`全社の産休・育休・介護休業の申出 ${props.total} 件`}>
        <TableHeader>
          <TableRow>
            <TableHead>種別</TableHead>
            <TableHead>従業員 ID</TableHead>
            <TableHead>期間</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead className="hidden md:table-cell">申出日</TableHead>
            {props.canManage ? <TableHead>操作</TableHead> : null}
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <span className="font-medium">{familyCareLeaveKindLabel(row.leave_kind)}</span>
              </TableCell>

              <TableCell className="text-muted-foreground">
                <Link
                  href={`/family-care-leave/family-care-leaves?employee_id=${row.employee_id}`}
                  className="underline-offset-4 hover:underline"
                  aria-label={`従業員 ${row.employee_id} の申出で絞り込む`}
                >
                  {row.employee_id}
                </Link>
              </TableCell>

              <TableCell className="text-muted-foreground">
                {row.start_date === row.end_date
                  ? row.start_date
                  : `${row.start_date} 〜 ${row.end_date}`}
              </TableCell>

              <TableCell>{statusLabel(row.status)}</TableCell>

              <TableCell className="hidden text-muted-foreground md:table-cell">
                {formatDateTime(row.created_at)}
              </TableCell>

              {props.canManage ? (
                <TableCell>
                  {row.status === "requested" ? (
                    <FamilyCareLeaveAdminActions familyCareLeaveId={row.id} />
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
