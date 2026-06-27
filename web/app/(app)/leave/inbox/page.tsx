import { FetchError } from "@/components/fetch-error"
import Link from "next/link"
import { Suspense } from "react"
import { LeaveInboxDecisionForm } from "@/app/(app)/leave/inbox/_components/leave-inbox-decision-form"
import { EmptyState } from "@/components/empty-state"
import { LeaveStatusBadge } from "@/components/leave-status-badge"
import { LeaveTypeLabel } from "@/components/leave-type-label"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getLeaveInbox } from "@/lib/api/get-leave-inbox"

export const metadata = { title: "承認待ちの休暇" }

// 休暇の承認 inbox 画面。RSC で承認待ち一覧を取得し、各行に承認/却下フォームを置く。
export default function LeaveInboxPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="休暇の承認 inbox"
        description="承認待ちの休暇申請を確認します。"
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/leave" />}>
            休暇へ戻る
          </Button>
        }
      />

      <Suspense fallback={<ListSkeleton rows={4} rowClassName="h-16 w-full" />}>
        <LeaveInboxTable />
      </Suspense>
    </div>
  )
}

// /leave/requests/inbox を認証付きで取得して承認待ちテーブルを描画する非同期 RSC。
// 権限が無い場合は api が 403 を返すため Error として扱う。
async function LeaveInboxTable() {
  const leaveRequests = await getLeaveInbox()

  if (leaveRequests instanceof Error) {
    return <FetchError message="inbox の取得に失敗しました (承認権限が必要です)" />
  }

  if (leaveRequests.length === 0) {
    return <EmptyState title="承認待ちの休暇申請はありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>申請者</TableHead>
            <TableHead>種別</TableHead>
            <TableHead>期間</TableHead>
            <TableHead>日数</TableHead>
            <TableHead>理由</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead>操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {leaveRequests.map((leaveRequest) => (
            <TableRow key={leaveRequest.id}>
              <TableCell className="font-medium">{leaveRequest.applicant_name}</TableCell>

              <TableCell className="text-muted-foreground">
                <LeaveTypeLabel leaveType={leaveRequest.leave_type} />
              </TableCell>

              <TableCell className="text-muted-foreground">
                {leaveRequest.start_date} 〜 {leaveRequest.end_date}
              </TableCell>

              <TableCell className="text-muted-foreground">{leaveRequest.days} 日</TableCell>

              <TableCell className="text-muted-foreground">{leaveRequest.reason ?? "-"}</TableCell>

              <TableCell>
                <LeaveStatusBadge status={leaveRequest.status} />
              </TableCell>

              <TableCell>
                <LeaveInboxDecisionForm leaveRequestId={leaveRequest.id} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
