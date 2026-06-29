import { FetchError } from "@/components/fetch-error"
import Link from "next/link"
import { Suspense } from "react"
import { TablePagination } from "@/components/table-pagination"
import { InboxDecisionForm } from "@/app/(app)/applications/inbox/_components/inbox-decision-form"
import { ApplicationStatusBadge } from "@/components/application-status-badge"
import { EmptyState } from "@/components/empty-state"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { SortableTableHead } from "@/components/sortable-table-head"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getApplicationInbox, type ApplicationInboxSort } from "@/lib/api/get-application-inbox"

export const metadata = { title: "承認待ちの申請" }

const PAGE_SIZE = 20

const SORT_VALUES: ReadonlyArray<ApplicationInboxSort> = ["created_at_desc", "created_at_asc"]

type SearchParams = Promise<{ page?: string; sort?: string }>

function toSort(raw: string | undefined): ApplicationInboxSort {
  if (raw !== undefined && (SORT_VALUES as ReadonlyArray<string>).includes(raw)) {
    return raw as ApplicationInboxSort
  }

  return "created_at_desc"
}

// 承認 inbox 画面。RSC で承認待ち一覧を取得し、各行に承認/却下フォームを置く。
export default async function ApplicationInboxPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams

  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1)

  const offset = (page - 1) * PAGE_SIZE

  const sort = toSort(searchParams.sort)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="申請の承認 inbox"
        description="承認待ちの申請を確認します。"
        breadcrumbs={[{ label: "申請", href: "/applications" }, { label: "承認 inbox" }]}
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/applications" />}>
            申請一覧へ
          </Button>
        }
      />

      <Suspense fallback={<ListSkeleton rows={4} rowClassName="h-16 w-full" />}>
        <InboxTable offset={offset} sort={sort} />
      </Suspense>
    </div>
  )
}

async function InboxTable(props: { offset: number; sort: ApplicationInboxSort }) {
  const result = await getApplicationInbox({
    limit: PAGE_SIZE,
    offset: props.offset,
    sort: props.sort,
  })

  if (result instanceof Error) {
    return <FetchError message="inbox の取得に失敗しました" />
  }

  if (result.data.length === 0) {
    return <EmptyState title="承認待ちの申請はありません" />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <Table aria-label={`承認待ちの申請 ${result.total} 件`}>
          <TableHeader>
            <TableRow>
              <TableHead>申請名</TableHead>
              <TableHead>申請者</TableHead>
              <TableHead>ステータス</TableHead>
              <SortableTableHead
                pathname="/applications/inbox"
                currentSort={props.sort}
                ascValue="created_at_asc"
                descValue="created_at_desc"
                label="申請日"
                className="hidden md:table-cell"
              />
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {result.data.map((application) => (
              <TableRow key={application.id}>
                <TableCell>
                  <Link
                    href={`/applications/${application.id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {application.template_name}
                  </Link>
                </TableCell>

                <TableCell className="text-muted-foreground">
                  {application.applicant_name}
                </TableCell>

                <TableCell>
                  <ApplicationStatusBadge status={application.status} />
                </TableCell>

                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {application.created_at}
                </TableCell>

                <TableCell>
                  <InboxDecisionForm applicationId={application.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        pathname="/applications/inbox"
        total={result.total}
        limit={PAGE_SIZE}
        offset={props.offset}
        extraParams={{ sort: props.sort === "created_at_desc" ? undefined : props.sort }}
      />
    </div>
  )
}
