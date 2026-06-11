import Link from "next/link"
import { Suspense } from "react"
import { LeaveInboxDecisionForm } from "@/app/(app)/leave/inbox/_components/leave-inbox-decision-form"
import { LeaveStatusBadge } from "@/components/leave-status-badge"
import { LeaveTypeLabel } from "@/components/leave-type-label"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
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
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">休暇 承認 inbox</h1>

        <Button variant="outline" render={<Link href="/leave" />}>
          休暇へ戻る
        </Button>
      </div>

      <Suspense fallback={<LeaveInboxSkeleton />}>
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
    return (
      <p className="text-sm text-destructive">inbox の取得に失敗しました (承認権限が必要です)</p>
    )
  }

  if (leaveRequests.length === 0) {
    return <p className="text-sm text-muted-foreground">承認待ちの休暇申請はありません</p>
  }

  return (
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
  )
}

function LeaveInboxSkeleton() {
  const placeholders = [0, 1, 2, 3]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-16 w-full" />
      ))}
    </div>
  )
}
