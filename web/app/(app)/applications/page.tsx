import { FetchError } from "@/components/fetch-error"
import Link from "next/link"
import { Suspense } from "react"
import { MyApplicationsList } from "@/app/(app)/applications/_components/my-applications-list"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { TablePagination } from "@/components/table-pagination"
import { Button } from "@/components/ui/button"
import { listMyApplications } from "@/lib/api/list-my-applications"

export const metadata = { title: "申請" }

const PAGE_SIZE = 20

type SearchParams = Promise<{ page?: string }>

// 自分の申請一覧画面。RSC でサーバ取得し、承認待ちは変更・取り下げ操作付きで表示する。
export default async function MyApplicationsPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams

  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1)

  const offset = (page - 1) * PAGE_SIZE

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="申請"
        description="自分の申請の状況を確認します。"
        actions={
          <>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/applications/inbox" />}
            >
              承認 inbox
            </Button>

            <Button nativeButton={false} render={<Link href="/applications/templates" />}>
              新規申請
            </Button>
          </>
        }
      />

      <Suspense fallback={<ListSkeleton rows={5} />}>
        <MyApplicationsTable offset={offset} />
      </Suspense>
    </div>
  )
}

async function MyApplicationsTable(props: { offset: number }) {
  const result = await listMyApplications({ limit: PAGE_SIZE, offset: props.offset })

  if (result instanceof Error) {
    return <FetchError message="申請一覧の取得に失敗しました" />
  }

  return (
    <div className="flex flex-col gap-4">
      <MyApplicationsList applications={result.data} />

      <TablePagination
        pathname="/applications"
        total={result.total}
        limit={PAGE_SIZE}
        offset={props.offset}
      />
    </div>
  )
}
