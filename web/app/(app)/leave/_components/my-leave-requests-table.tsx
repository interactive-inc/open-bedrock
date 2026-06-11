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

// /leave/requests/me を認証付きで取得し、自分の休暇申請一覧テーブルを描画する非同期 RSC。
export async function MyLeaveRequestsTable() {
  const leaveRequests = await getMyLeaveRequests(null)

  if (leaveRequests instanceof Error) {
    return <p className="text-sm text-destructive">休暇申請一覧の取得に失敗しました</p>
  }

  if (leaveRequests.length === 0) {
    return <p className="text-sm text-muted-foreground">提出済みの休暇申請はまだありません</p>
  }

  return (
    <Table>
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

            <TableCell className="text-muted-foreground">{leaveRequest.created_at}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
