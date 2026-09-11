import Link from "next/link"
import { formatDateTime } from "@/lib/format-date-time"
import { EmptyState } from "@/components/empty-state"
import { FetchError } from "@/components/fetch-error"
import { leaveProcedureStatusLabel } from "@/lib/leave/leave-procedure-status-label"
import { LeaveTypeLabel } from "@/components/leave-type-label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getMyLeaveRequests } from "@/lib/api/get-my-leave-requests"

/** /leave/requests/me を認証付きで取得し、自分の休暇申請一覧テーブルを描画する非同期 RSC。 */
export async function MyLeaveRequestsTable() {
  const leaveRequests = await getMyLeaveRequests(null)

  if (leaveRequests instanceof Error) {
    return <FetchError message="休暇申請一覧の取得に失敗しました" />
  }

  if (leaveRequests.length === 0) {
    return <EmptyState title="休暇の記録はまだありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>種別</TableHead>
            <TableHead>期間</TableHead>
            <TableHead>日数</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead>申請日</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {leaveRequests.map((leaveRequest) => (
            <TableRow key={leaveRequest.id}>
              <TableCell>
                <Link href={`/my/leaves/${leaveRequest.id}`}>
                  <LeaveTypeLabel leaveType={leaveRequest.leave_type} />
                </Link>
              </TableCell>

              <TableCell>
                {leaveRequest.start_date} 〜 {leaveRequest.end_date}
              </TableCell>

              <TableCell>{leaveRequest.days} 日</TableCell>

              <TableCell>{leaveProcedureStatusLabel(leaveRequest.status, false)}</TableCell>

              <TableCell>{formatDateTime(leaveRequest.created_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
