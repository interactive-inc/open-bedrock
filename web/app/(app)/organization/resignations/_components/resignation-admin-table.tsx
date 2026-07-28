import Link from "next/link"
import { ResignationAdminActions } from "@/app/(app)/organization/resignations/_components/resignation-admin-actions"
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
  employee_id: number
  resignation_date: string
  last_working_date: string | null
  reason: string | null
  status: string
  created_at: string
}

type Props = {
  rows: ReadonlyArray<Row>
  total: number
  canManage: boolean
}

/** 全社の退職手続き一覧テーブル。詳細は各手続きのページへ、従業員 ID クリックで絞り込む。 */
export function ResignationAdminTable(props: Props) {
  if (props.rows.length === 0) {
    return <EmptyState title="条件に一致する退職手続きがありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label={`全社の退職手続き ${props.total} 件`}>
        <TableHeader>
          <TableRow>
            <TableHead>従業員 ID</TableHead>
            <TableHead>退職日</TableHead>
            <TableHead className="hidden md:table-cell">最終出社日</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead className="hidden md:table-cell">申請日</TableHead>
            {props.canManage ? <TableHead>操作</TableHead> : null}
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Link
                  href={`/organization/resignations?employee_id=${row.employee_id}`}
                  className="font-medium underline-offset-4 hover:underline"
                  aria-label={`従業員 ${row.employee_id} の退職手続きで絞り込む`}
                >
                  {row.employee_id}
                </Link>
              </TableCell>

              <TableCell className="text-muted-foreground">{row.resignation_date}</TableCell>

              <TableCell className="hidden text-muted-foreground md:table-cell">
                {row.last_working_date ?? "—"}
              </TableCell>

              <TableCell>{statusLabel(row.status)}</TableCell>

              <TableCell className="hidden text-muted-foreground md:table-cell">
                {formatDateTime(row.created_at)}
              </TableCell>

              {props.canManage ? (
                <TableCell>
                  {row.status === "requested" ? (
                    <ResignationAdminActions resignationId={row.id} />
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
