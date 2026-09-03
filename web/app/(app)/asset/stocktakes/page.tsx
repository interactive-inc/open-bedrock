import { FetchError } from "@/components/fetch-error"
import Link from "next/link"
import { Suspense } from "react"
import { BackButton } from "@/components/back-button"
import { EmptyState } from "@/components/empty-state"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { StocktakeStatusBadge } from "@/components/stocktake-status-badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getStocktakeList } from "@/lib/api/get-stocktake-list"
import { requirePermission } from "@/lib/auth/require-permission"

export const metadata = { title: "棚卸し" }

/** 棚卸しセッション一覧画面。RSC で取得し、確認進捗と状態を表示する。 */
export default async function StocktakesPage() {
  await requirePermission("asset:manage")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="棚卸し"
        description="棚卸しセッションを開始し、対象資産の現物確認を記録します。"
        actions={
          <>
            <BackButton href="/asset/assets" label="備品に戻る" />

            <Button nativeButton={false} render={<Link href="/asset/stocktakes/new" />}>
              棚卸しを開始
            </Button>
          </>
        }
      />

      <Suspense fallback={<ListSkeleton rows={5} />}>
        <StocktakesTable />
      </Suspense>
    </div>
  )
}

/** /stocktakes を認証付きで取得して一覧テーブルを描画する非同期 RSC。 */
async function StocktakesTable() {
  const stocktakes = await getStocktakeList(null)

  if (stocktakes instanceof Error) {
    return <FetchError message="棚卸し一覧の取得に失敗しました" />
  }

  if (stocktakes.length === 0) {
    return <EmptyState title="棚卸しはまだありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="棚卸し一覧">
        <TableHeader>
          <TableRow>
            <TableHead>名称</TableHead>
            <TableHead>対象日</TableHead>
            <TableHead>状態</TableHead>
            <TableHead>進捗</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {stocktakes.map((stocktake) => (
            <TableRow key={stocktake.id}>
              <TableCell>
                <Link
                  href={`/asset/stocktakes/${stocktake.id}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {stocktake.name}
                </Link>
              </TableCell>

              <TableCell className="text-muted-foreground">{stocktake.target_date}</TableCell>

              <TableCell>
                <StocktakeStatusBadge status={stocktake.status} />
              </TableCell>

              <TableCell className="text-muted-foreground">
                {stocktake.checked_count} / {stocktake.total_count}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
