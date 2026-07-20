import { FetchError } from "@/components/fetch-error"
import Link from "next/link"
import { Suspense } from "react"
import { LeaveInboxDecisionForm } from "@/app/(app)/inbox/leaves/_components/leave-inbox-decision-form"
import { EmptyState } from "@/components/empty-state"
import { LeaveStatusBadge } from "@/components/leave-status-badge"
import { LeaveTypeLabel } from "@/components/leave-type-label"
import { ListSkeleton } from "@/components/list-skeleton"
import { SubPageHeader } from "@/components/sub-page-header"
import { SortableTableHead } from "@/components/sortable-table-head"
import { PAGE_SIZE_OPTIONS, TablePagination, parsePageSize } from "@/components/table-pagination"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getLeaveInbox, type LeaveInboxSort } from "@/lib/api/get-leave-inbox"
import { requirePermission } from "@/lib/auth/require-permission"

export const metadata = { title: "承認待ちの休暇" }

const SORT_VALUES: ReadonlyArray<LeaveInboxSort> = [
  "created_at_desc",
  "created_at_asc",
  "start_date_desc",
  "start_date_asc",
]

type SearchParams = Promise<{ page?: string; size?: string; sort?: string }>

function toSort(raw: string | undefined): LeaveInboxSort {
  if (raw !== undefined && (SORT_VALUES as ReadonlyArray<string>).includes(raw)) {
    return raw as LeaveInboxSort
  }

  return "created_at_desc"
}

/** 休暇の承認 inbox 画面。RSC で承認待ち一覧を取得し、各行に承認/却下フォームを置く。 */
export default async function LeaveInboxPage(props: { searchParams: SearchParams }) {
  await requirePermission("leave:approve")

  const searchParams = await props.searchParams

  const pageSize = parsePageSize(searchParams.size)

  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1)

  const offset = (page - 1) * pageSize

  const sort = toSort(searchParams.sort)

  return (
    <div className="flex flex-col gap-6">
      <SubPageHeader
        title="承認待ちの休暇"
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/my/leaves" />}>
            休暇へ戻る
          </Button>
        }
      />

      <Suspense fallback={<ListSkeleton rows={4} rowClassName="h-16 w-full" />}>
        <LeaveInboxTable offset={offset} pageSize={pageSize} sort={sort} />
      </Suspense>
    </div>
  )
}

/**
 * /leave/requests/inbox を認証付きで取得して承認待ちテーブルを描画する非同期 RSC。
 * 権限が無い場合は api が 403 を返すため Error として扱う。
 */
async function LeaveInboxTable(props: { offset: number; pageSize: number; sort: LeaveInboxSort }) {
  const result = await getLeaveInbox({
    limit: props.pageSize,
    offset: props.offset,
    sort: props.sort,
  })

  if (result instanceof Error) {
    return <FetchError message="inbox の取得に失敗しました (承認権限が必要です)" />
  }

  if (result.data.length === 0) {
    return <EmptyState title="承認待ちの休暇申請はありません" />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <Table aria-label={`承認待ちの休暇申請 ${result.total} 件`}>
          <TableHeader>
            <TableRow>
              <TableHead>申請者</TableHead>
              <TableHead>種別</TableHead>
              <SortableTableHead
                pathname="/inbox/leaves"
                currentSort={props.sort}
                ascValue="start_date_asc"
                descValue="start_date_desc"
                label="期間"
                className="hidden md:table-cell"
              />
              <TableHead className="hidden sm:table-cell">日数</TableHead>
              <TableHead className="hidden lg:table-cell">理由</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {result.data.map((leaveRequest) => (
              <TableRow key={leaveRequest.id}>
                <TableCell className="font-medium">{leaveRequest.applicant_name}</TableCell>

                <TableCell className="text-muted-foreground">
                  <LeaveTypeLabel leaveType={leaveRequest.leave_type} />
                </TableCell>

                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {leaveRequest.start_date} 〜 {leaveRequest.end_date}
                </TableCell>

                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {leaveRequest.days} 日
                </TableCell>

                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {leaveRequest.reason ?? "-"}
                </TableCell>

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

      <TablePagination
        pathname="/inbox/leaves"
        total={result.total}
        limit={props.pageSize}
        offset={props.offset}
        extraParams={{
          sort: props.sort === "created_at_desc" ? undefined : props.sort,
          size: String(props.pageSize),
        }}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />
    </div>
  )
}
