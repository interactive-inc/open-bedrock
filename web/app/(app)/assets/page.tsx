import Link from "next/link"
import { Suspense } from "react"
import { AssetFilterForm } from "@/app/(app)/assets/asset-filter-form"
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
import { getAssetList } from "@/lib/api/get-asset-list"
import type { AssetKind, AssetStatus } from "@/lib/api/types/asset-types"

export const metadata = { title: "備品" }

const VALID_KINDS: readonly string[] = ["pc", "monitor", "furniture", "other"]
const VALID_STATUSES: readonly string[] = ["in_stock", "lent"]

function toAssetKind(value: string | undefined): AssetKind | null {
  return value !== undefined && VALID_KINDS.includes(value) ? (value as AssetKind) : null
}

function toAssetStatus(value: string | undefined): AssetStatus | null {
  return value !== undefined && VALID_STATUSES.includes(value) ? (value as AssetStatus) : null
}

type Props = {
  searchParams: Promise<{ kind?: string; status?: string }>
}

// 物品一覧画面。種別/状態で絞り込み、RSC でサーバ取得してテーブル表示する。
export default async function AssetsPage(props: Props) {
  const searchParams = await props.searchParams

  const kind = toAssetKind(searchParams.kind)

  const status = toAssetStatus(searchParams.status)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">備品</h1>

        <div className="flex items-center gap-2">
          <Button variant="outline" render={<Link href="/assets/lent/me" />}>
            自分の貸与品
          </Button>

          <Button render={<Link href="/assets/new" />}>物品を登録</Button>
        </div>
      </div>

      <AssetFilterForm kind={kind} status={status} />

      <Suspense fallback={<AssetsSkeleton />}>
        <AssetsTable kind={kind} status={status} />
      </Suspense>
    </div>
  )
}

type TableProps = {
  kind: AssetKind | null
  status: AssetStatus | null
}

// /assets を認証付きで取得して一覧テーブルを描画する非同期 RSC。
async function AssetsTable(props: TableProps) {
  const assets = await getAssetList({ kind: props.kind, status: props.status })

  if (assets instanceof Error) {
    return <p className="text-sm text-destructive">物品一覧の取得に失敗しました</p>
  }

  if (assets.length === 0) {
    return <p className="text-sm text-muted-foreground">該当する物品はありません</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>コード</TableHead>
          <TableHead>名称</TableHead>
          <TableHead>種別</TableHead>
          <TableHead>状態</TableHead>
          <TableHead>保有者</TableHead>
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

            <TableCell className="text-muted-foreground">
              {asset.holder_employee_id === null ? "-" : `#${asset.holder_employee_id}`}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function AssetsSkeleton() {
  const placeholders = [0, 1, 2, 3, 4]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}
