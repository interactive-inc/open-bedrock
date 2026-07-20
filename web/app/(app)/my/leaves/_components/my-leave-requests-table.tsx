import { formatDateTime } from "@/lib/format-datetime"
import { EmptyState } from "@/components/empty-state"
import { FetchError } from "@/components/fetch-error"
import { LeaveStatusBadge } from "@/components/leave-status-badge"
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
    return <EmptyState title="提出済みの休暇申請はまだありません" />
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
              <TableCell className="font-medium">
                <LeaveTypeLabel leaveType={leaveRequest.leave_type} />
              </TableCell>

              <TableCell className="text-muted-foreground">
                {leaveRequest.start_date} 〜 {leaveRequest.end_date}
              </TableCell>

              <TableCell className="text-muted-foreground">{leaveRequest.days} 日</TableCell>

              <TableCell>
                <LeaveStatusBadge status={leaveRequest.status} />
              </TableCell>

              <TableCell className="text-muted-foreground">
                {formatDateTime(leaveRequest.created_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
