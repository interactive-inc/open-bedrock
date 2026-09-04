import { StocktakeCheckForm } from "@/app/(app)/asset/stocktakes/_components/stocktake-check-form"
import { StocktakeCloseButton } from "@/app/(app)/asset/stocktakes/_components/stocktake-close-button"
import { AssetKindLabel } from "@/components/asset-kind-label"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { StocktakeStatusBadge } from "@/components/stocktake-status-badge"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getStocktake } from "@/lib/api/get-stocktake"
import { handleDetailError } from "@/lib/api/handle-detail-error"
import { requirePermission } from "@/lib/auth/require-permission"

export const metadata = { title: "棚卸し詳細" }

type Props = {
  params: Promise<{ stocktake: string }>
}

/** 棚卸し詳細画面。RSC で 1 件取得し、対象資産ごとの確認状況と操作を表示する。 */
export default async function StocktakeDetailPage(props: Props) {
  await requirePermission("asset:manage")

  const params = await props.params

  const stocktake = await getStocktake(params.stocktake)

  if (stocktake instanceof Error) {
    handleDetailError(stocktake)
  }

  const isOpen = stocktake.status === "open"

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={stocktake.name}>
        <BackButton href="/asset/stocktakes" label="一覧に戻る" />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-4">
        <StocktakeStatusBadge status={stocktake.status} />

        <span className="text-sm text-muted-foreground">
          対象日 {stocktake.target_date} ・ 確認 {stocktake.checked_count} / {stocktake.total_count}
        </span>

        {isOpen ? <StocktakeCloseButton id={stocktake.id} /> : null}
      </div>

      <Card className="gap-0">
        <div className="overflow-x-auto">
          <Table aria-label="棚卸し対象一覧">
            <TableHeader>
              <TableRow>
                <TableHead>資産</TableHead>
                <TableHead>種別</TableHead>
                <TableHead>確認</TableHead>
                <TableHead>所在メモ</TableHead>
                {isOpen ? <TableHead>操作</TableHead> : null}
              </TableRow>
            </TableHeader>

            <TableBody>
              {stocktake.items.map((item) => (
                <TableRow key={item.asset_code}>
                  <TableCell>
                    {item.asset_name}
                    <span className="text-muted-foreground"> ({item.asset_code})</span>
                  </TableCell>

                  <TableCell>
                    <AssetKindLabel kind={item.kind} />
                  </TableCell>

                  <TableCell>
                    {item.checked_at === null ? (
                      <span className="text-muted-foreground">未確認</span>
                    ) : (
                      <span className="text-emerald-600">確認済み</span>
                    )}
                  </TableCell>

                  <TableCell>{item.location_note ?? "-"}</TableCell>

                  {isOpen ? (
                    <TableCell>
                      <StocktakeCheckForm
                        id={stocktake.id}
                        assetCode={item.asset_code}
                        checked={item.checked_at !== null}
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
