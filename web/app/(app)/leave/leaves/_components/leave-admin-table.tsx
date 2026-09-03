import { formatDateTime } from "@/lib/format-date-time"
import Link from "next/link"
import { EmptyState } from "@/components/empty-state"
import { LeaveStatusBadge } from "@/components/leave-status-badge"
import { LeaveTypeLabel } from "@/components/leave-type-label"
import { SortableTableHead } from "@/components/sortable-table-head"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { LeaveAdminSort } from "@/lib/api/get-leave-admin-list"
import type { LeaveStatus, LeaveType } from "@/lib/api/types/leave-types"

export type LeaveAdminRow = {
  id: number
  applicant_id: string
  applicant_name: string
  applicant_dept_name: string | null
  leave_type: LeaveType
  start_date: string
  end_date: string
  days: number
  reason: string | null
  status: LeaveStatus
  created_at: string
}

type Props = {
  rows: ReadonlyArray<LeaveAdminRow>
  total: number
  currentSort: LeaveAdminSort
  extraParams: Record<string, string | undefined>
}

export function LeaveAdminTable(props: Props) {
  if (props.rows.length === 0) {
    return <EmptyState title="条件に一致する休暇申請がありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label={`全社の休暇申請 ${props.total} 件`}>
        <TableHeader>
          <TableRow>
            <TableHead>種別</TableHead>
            <TableHead>申請者</TableHead>
            <TableHead className="hidden md:table-cell">部署</TableHead>
            <SortableTableHead
              pathname="/leave/leaves"
              currentSort={props.currentSort}
              ascValue="start_date_asc"
              descValue="start_date_desc"
              label="期間"
              extraParams={props.extraParams}
            />
            <TableHead className="hidden md:table-cell">日数</TableHead>
            <TableHead>ステータス</TableHead>
            <SortableTableHead
              pathname="/leave/leaves"
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
                <span className="font-medium">
                  <LeaveTypeLabel leaveType={row.leave_type} />
                </span>
              </TableCell>

              <TableCell className="text-muted-foreground">
                <Link
                  href={`/leave/leaves?applicant_id=${row.applicant_id}`}
                  className="underline-offset-4 hover:underline"
                  aria-label={`${row.applicant_name} の休暇申請で絞り込む`}
                >
                  {row.applicant_name}
                </Link>
              </TableCell>

              <TableCell className="hidden text-muted-foreground md:table-cell">
                {row.applicant_dept_name ?? "—"}
              </TableCell>

              <TableCell className="text-muted-foreground">
                {row.start_date === row.end_date
                  ? row.start_date
                  : `${row.start_date} 〜 ${row.end_date}`}
              </TableCell>

              <TableCell className="hidden tabular-nums md:table-cell">{row.days} 日</TableCell>

              <TableCell>
                <LeaveStatusBadge status={row.status} />
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
