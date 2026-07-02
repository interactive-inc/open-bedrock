import { Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { OneOnOneList } from "@/app/(app)/oneonone/_components/oneonone-list"
import { FetchError } from "@/components/fetch-error"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { TablePagination } from "@/components/table-pagination"
import { Button } from "@/components/ui/button"
import { getOneOnOneList } from "@/lib/api/get-oneonone-list"

export const metadata = { title: "1on1" }

const PAGE_SIZE = 20

type SearchParams = Promise<{ page?: string }>

/**
 * 1on1 履歴一覧。記録の作成は /oneonone/new に分離。
 */
export default async function OneOnOnePage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams

  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1)

  const offset = (page - 1) * PAGE_SIZE

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="1on1"
        description="自分の参加した 1on1 の履歴を確認します。"
        actions={
          <Button nativeButton={false} render={<Link href="/oneonone/new" />}>
            <Plus />
            記録を追加
          </Button>
        }
      />

      <Suspense fallback={<ListSkeleton rows={3} rowClassName="h-32 w-full" />}>
        <OneOnOneSection offset={offset} />
      </Suspense>
    </div>
  )
}

async function OneOnOneSection(props: { offset: number }) {
  const result = await getOneOnOneList({ limit: PAGE_SIZE, offset: props.offset })

  if (result instanceof Error) {
    return <FetchError message="1on1 の取得に失敗しました" />
  }

  return (
    <div className="flex flex-col gap-4">
      <OneOnOneList oneOnOnes={result.data} />

      <TablePagination
        pathname="/oneonone"
        total={result.total}
        limit={PAGE_SIZE}
        offset={props.offset}
      />
    </div>
  )
}
