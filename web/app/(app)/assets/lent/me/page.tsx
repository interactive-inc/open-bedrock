import Link from "next/link"
import { Suspense } from "react"
import { AssetKindLabel } from "@/components/asset-kind-label"
import { AssetStatusBadge } from "@/components/asset-status-badge"
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
import { getMyLentAssets } from "@/lib/api/get-my-lent-assets"

export const metadata = { title: "貸出中の備品" }

// 自分の貸与品一覧画面。RSC で GET /assets/lent/me を取得してテーブル表示する。
export default function MyLentAssetsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">自分の貸与品</h1>

        <Button variant="outline" render={<Link href="/assets" />}>
          備品一覧へ
        </Button>
      </div>

      <Suspense fallback={<MyLentAssetsSkeleton />}>
        <MyLentAssetsTable />
      </Suspense>
    </div>
  )
}

// /assets/lent/me を認証付きで取得して貸与品テーブルを描画する非同期 RSC。
async function MyLentAssetsTable() {
  const assets = await getMyLentAssets()

  if (assets instanceof Error) {
    return <p className="text-sm text-destructive">貸与品の取得に失敗しました</p>
  }

  if (assets.length === 0) {
    return <p className="text-sm text-muted-foreground">現在借りている物品はありません</p>
  }

  return (
    <Table>
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
                href={`/assets/${asset.code}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {asset.code}
              </Link>
            </TableCell>

            <TableCell>{asset.name}</TableCell>

            <TableCell className="text-muted-foreground">
              <AssetKindLabel kind={asset.kind} />
            </TableCell>

            <TableCell>
              <AssetStatusBadge status={asset.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function MyLentAssetsSkeleton() {
  const placeholders = [0, 1, 2, 3]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}
