import Link from "next/link"
import { getLeaveInbox } from "@/lib/api/get-leave-inbox"
import { FetchError } from "@/components/fetch-error"
import { PageHeader } from "@/components/page-header"
import { LeaveTypeLabel } from "@/components/leave-type-label"
import { requirePermission } from "@/lib/auth/require-permission"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Props = { searchParams: Promise<{ offset?: string }> }
export const metadata = { title: "承認待ちの休暇" }

/** 現在の判断資格がある休暇から、内容確認と判断へ進む。 */
export default async function LeaveInboxPage(props: Props) {
  await requirePermission("leave:approve")
  const params = await props.searchParams
  const offset = Math.max(0, Number.parseInt(params.offset ?? "0", 10) || 0)
  const result = await getLeaveInbox({ limit: 20, offset })
  if (result instanceof Error) return <FetchError message={result.message} />
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="承認待ちの休暇">
        <Link href="/my/leaves">休暇へ戻る</Link>
      </PageHeader>
      {result.data.length === 0 ? (
        <p>この範囲に判断・確定待ちの休暇はありません。</p>
      ) : (
        <Table aria-label="承認待ちの休暇">
          <TableHeader>
            <TableRow>
              <TableHead>申請者</TableHead>
              <TableHead>種別</TableHead>
              <TableHead>期間</TableHead>
              <TableHead>承認人数</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.data.map((leave) => (
              <TableRow key={leave.id}>
                <TableCell>{leave.applicant_name}</TableCell>
                <TableCell>
                  <LeaveTypeLabel leaveType={leave.leave_type} />
                </TableCell>
                <TableCell>
                  {leave.start_date} 〜 {leave.end_date}
                </TableCell>
                <TableCell>
                  {leave.approvals} / {leave.required_approvals ?? "—"}
                </TableCell>
                <TableCell>
                  <Link href={`/my/leaves/${leave.id}`}>
                    {leave.can_execute ? "内容を確認して確定" : "内容を確認して判断"}
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <nav aria-label="受信箱のページ" className="flex gap-4">
        {offset > 0 ? (
          <Link href={`/inbox/leaves?offset=${Math.max(0, offset - 20)}`}>前へ</Link>
        ) : null}
        {result.next_offset !== null ? (
          <Link href={`/inbox/leaves?offset=${result.next_offset}`}>次へ</Link>
        ) : null}
      </nav>
    </div>
  )
}
