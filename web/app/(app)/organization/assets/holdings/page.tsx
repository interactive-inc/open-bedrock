import { FetchError } from "@/components/fetch-error"
import Link from "next/link"
import { Suspense } from "react"
import { AssetKindLabel } from "@/components/asset-kind-label"
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
import { getAssetHoldings } from "@/lib/api/get-asset-holdings"
import { requirePermission } from "@/lib/auth/require-permission"

export const metadata = { title: "保有状況" }

/** 保有状況一覧画面。現在貸出中の資産を「誰が何を持っているか」で横断表示する。管理者向け。 */
export default async function AssetHoldingsPage() {
  await requirePermission("asset:manage")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="保有状況"
        description="現在貸与中の物品を、保有者ごとに横断で確認します。"
        actions={<BackButton href="/organization/assets" label="一覧に戻る" />}
      />

      <Suspense fallback={<ListSkeleton rows={5} />}>
        <HoldingsTable />
      </Suspense>
    </div>
  )
}

/** /assets/holdings を認証付きで取得して一覧テーブルを描画する非同期 RSC。 */
async function HoldingsTable() {
  const holdings = await getAssetHoldings()

  if (holdings instanceof Error) {
    return <FetchError message="保有状況の取得に失敗しました（権限が必要です）" />
  }

  if (holdings.length === 0) {
    return <EmptyState title="貸与中の物品はありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="保有状況一覧">
        <TableHeader>
          <TableRow>
            <TableHead>保有者</TableHead>
            <TableHead>資産</TableHead>
            <TableHead>種別</TableHead>
            <TableHead>貸出日</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {holdings.map((holding) => (
            <TableRow key={holding.asset_code}>
              <TableCell>
                {holding.holder_employee_name}
                <span className="text-muted-foreground"> ({holding.holder_employee_code})</span>
              </TableCell>

              <TableCell>
                <Link
                  href={`/organization/assets/${holding.asset_code}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {holding.asset_name}
                </Link>
                <span className="text-muted-foreground"> ({holding.asset_code})</span>
              </TableCell>

              <TableCell className="text-muted-foreground">
                <AssetKindLabel kind={holding.kind} />
              </TableCell>

              <TableCell className="text-muted-foreground">
                {holding.lent_at === null ? "-" : holding.lent_at.slice(0, 10)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
