import { EmptyState } from "@/components/empty-state"
import { LeaveStatusBadge } from "@/components/leave-status-badge"
import { LeaveTypeLabel } from "@/components/leave-type-label"
import { SubPageHeader } from "@/components/sub-page-header"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getDepartmentLeaveRequests } from "@/lib/api/get-department-leave-requests"

export const metadata = { title: "部署の休暇" }

type Props = {
  params: Promise<{ team: string }>
}

/**
 * 部署ハブの休暇タブ。所属メンバー全員の休暇申請を一覧する。
 * 閲覧には leave:read:all、または本人が所属する部署への leave:read:department が必要。
 */
export default async function DepartmentLeavesPage(props: Props) {
  const params = await props.params

  const requests = await getDepartmentLeaveRequests(params.team)

  if (requests instanceof Error) {
    return (
      <div className="flex flex-col gap-6">
        <SubPageHeader title="休暇" />

        <EmptyState title="この部署の休暇を閲覧する権限がありません" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <SubPageHeader title="休暇" />

      {requests.length === 0 ? (
        <EmptyState title="この部署の休暇申請はまだありません" />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>申請者</TableHead>

                <TableHead>種別</TableHead>

                <TableHead>期間</TableHead>

                <TableHead>日数</TableHead>

                <TableHead>状態</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {request.applicant_name}
                  </TableCell>

                  <TableCell className="whitespace-nowrap">
                    <LeaveTypeLabel leaveType={request.leave_type} />
                  </TableCell>

                  <TableCell className="whitespace-nowrap">
                    {request.start_date} 〜 {request.end_date}
                  </TableCell>

                  <TableCell>{request.days}</TableCell>

                  <TableCell className="whitespace-nowrap">
                    <LeaveStatusBadge status={request.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
