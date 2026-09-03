import { FetchError } from "@/components/fetch-error"
import Link from "next/link"
import { Suspense } from "react"
import { AssetKindLabel } from "@/components/asset-kind-label"
import { AssetStatusBadge } from "@/components/asset-status-badge"
import { BackButton } from "@/components/back-button"
import { EmptyState } from "@/components/empty-state"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getMyLentAssets } from "@/lib/api/get-my-lent-assets"

export const metadata = { title: "貸与品" }

/** 自分の貸与品一覧画面。RSC で GET /assets/lent/me を取得してテーブル表示する。 */
export default function MyLentAssetsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="貸与品" actions={<BackButton href="/asset/assets" label="備品一覧へ" />} />

      <Suspense fallback={<ListSkeleton rows={4} />}>
        <MyLentAssetsTable />
      </Suspense>
    </div>
  )
}

/** /assets/lent/me を認証付きで取得して貸与品テーブルを描画する非同期 RSC。 */
async function MyLentAssetsTable() {
  const assets = await getMyLentAssets()

  if (assets instanceof Error) {
    return <FetchError message="貸与品の取得に失敗しました" />
  }

  if (assets.length === 0) {
    return <EmptyState title="現在借りている物品はありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>コード</TableHead>
            <TableHead>名称</TableHead>
            <TableHead>種別</TableHead>
            <TableHead>状態</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {assets.map((asset) => (
            <TableRow key={asset.code}>
              <TableCell>
                <Link
                  href={`/asset/assets/${asset.code}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {asset.code}
                </Link>
              </TableCell>

              <TableCell>{asset.name}</TableCell>

              <TableCell>
                <AssetKindLabel kind={asset.kind} />
              </TableCell>

              <TableCell>
                <AssetStatusBadge status={asset.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
