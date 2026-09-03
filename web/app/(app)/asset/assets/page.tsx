import { FetchError } from "@/components/fetch-error"
import Link from "next/link"
import { Suspense } from "react"
import { AssetFilterForm } from "@/app/(app)/asset/assets/_components/asset-filter-form"
import { AssetKindLabel } from "@/components/asset-kind-label"
import { AssetStatusBadge } from "@/components/asset-status-badge"
import { EmptyState } from "@/components/empty-state"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
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
import { getMe } from "@/lib/api/get-me"
import { canManageAssets } from "@/lib/asset/can-manage-assets"

export const metadata = { title: "備品" }

const VALID_KINDS = ["pc", "monitor", "furniture", "other"] as const
const VALID_STATUSES = ["in_stock", "lent"] as const

function toAssetKind(value: string | undefined): AssetKind | null {
  return VALID_KINDS.find((kind) => kind === value) ?? null
}

function toAssetStatus(value: string | undefined): AssetStatus | null {
  return VALID_STATUSES.find((status) => status === value) ?? null
}

type Props = {
  searchParams: Promise<{ kind?: string; status?: string }>
}

/** 物品一覧画面。種別/状態で絞り込み、RSC でサーバ取得してテーブル表示する。 */
export default async function AssetsPage(props: Props) {
  const [searchParams, currentUser] = await Promise.all([props.searchParams, getMe()])

  const kind = toAssetKind(searchParams.kind)

  const status = toAssetStatus(searchParams.status)

  const canManage = currentUser instanceof Error ? false : canManageAssets(currentUser.permissions)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="備品"
        actions={
          <>
            <Button variant="secondary" nativeButton={false} render={<Link href="/my/assets" />}>
              自分の貸与品
            </Button>

            {canManage ? (
              <>
                <Button
                  variant="secondary"
                  nativeButton={false}
                  render={<Link href="/asset/assets/holdings" />}
                >
                  保有状況
                </Button>

                <Button
                  variant="secondary"
                  nativeButton={false}
                  render={<Link href="/asset/stocktakes" />}
                >
                  棚卸し
                </Button>

                <Button nativeButton={false} render={<Link href="/asset/assets/new" />}>
                  物品を登録
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <AssetFilterForm kind={kind} status={status} />

      <Suspense fallback={<ListSkeleton rows={5} />}>
        <AssetsTable kind={kind} status={status} />
      </Suspense>
    </div>
  )
}

type TableProps = {
  kind: AssetKind | null
  status: AssetStatus | null
}

/** /assets を認証付きで取得して一覧テーブルを描画する非同期 RSC。 */
async function AssetsTable(props: TableProps) {
  const assets = await getAssetList({ kind: props.kind, status: props.status })

  if (assets instanceof Error) {
    return <FetchError message="物品一覧の取得に失敗しました" />
  }

  if (assets.length === 0) {
    return <EmptyState title="該当する物品はありません" />
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
            <TableHead>保有者</TableHead>
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

              <TableCell>
                {asset.holder_employee_id === null ? "-" : `#${asset.holder_employee_id}`}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
