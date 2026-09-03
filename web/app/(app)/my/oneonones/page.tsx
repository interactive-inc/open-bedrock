import { Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { OneOnOneList } from "@/app/(app)/my/oneonones/_components/oneonone-list"
import { FetchError } from "@/components/fetch-error"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { TablePagination } from "@/components/table-pagination"
import { PAGE_SIZE_OPTIONS, parsePageSize } from "@/lib/pagination/parse-page-size"
import { Button } from "@/components/ui/button"
import { getOneOnOneList } from "@/lib/api/get-oneonone-list"
import { getMe } from "@/lib/api/get-me"

export const metadata = { title: "1on1" }

type SearchParams = Promise<{ page?: string; size?: string }>

/**
 * 1on1 履歴一覧。記録の作成は /oneonone/new に分離。
 */
export default async function OneOnOnePage(props: { searchParams: SearchParams }) {
  const [searchParams, currentUser] = await Promise.all([props.searchParams, getMe()])

  const pageSize = parsePageSize(searchParams.size)

  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1)

  const offset = (page - 1) * pageSize

  const canCreate =
    currentUser instanceof Error ? false : currentUser.permissions.includes("oneonone:create")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="1on1"
        actions={
          canCreate ? (
            <Button nativeButton={false} render={<Link href="/my/oneonones/new" />}>
              <Plus />
              記録を追加
            </Button>
          ) : null
        }
      />

      <Suspense fallback={<ListSkeleton rows={3} rowClassName="h-32 w-full" />}>
        <OneOnOneSection offset={offset} pageSize={pageSize} />
      </Suspense>
    </div>
  )
}

async function OneOnOneSection(props: { offset: number; pageSize: number }) {
  const result = await getOneOnOneList({ limit: props.pageSize, offset: props.offset })

  if (result instanceof Error) {
    return <FetchError message="1on1 の取得に失敗しました" />
  }

  return (
    <div className="flex flex-col gap-4">
      <OneOnOneList oneOnOnes={result.data} />

      <TablePagination
        pathname="/my/oneonones"
        total={result.total}
        limit={props.pageSize}
        offset={props.offset}
        extraParams={{ size: String(props.pageSize) }}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />
    </div>
  )
}
