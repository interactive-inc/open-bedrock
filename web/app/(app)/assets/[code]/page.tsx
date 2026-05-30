import Link from "next/link"
import { notFound } from "next/navigation"
import { AssetLendForm } from "@/app/(app)/assets/asset-lend-form"
import { AssetReturnForm } from "@/app/(app)/assets/asset-return-form"
import { AssetKindLabel } from "@/components/asset-kind-label"
import { AssetStatusBadge } from "@/components/asset-status-badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { getAssetByCode } from "@/lib/api/get-asset-by-code"

type Props = {
  params: Promise<{ code: string }>
}

// 物品詳細画面。RSC で 1 件取得し、属性と貸与/返却の操作を表示する。
export default async function AssetDetailPage(props: Props) {
  const params = await props.params

  const asset = await getAssetByCode(params.code)

  if (asset instanceof Error) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">{asset.name}</h1>

          <AssetStatusBadge status={asset.status} />
        </div>

        <Button variant="outline" render={<Link href="/assets" />}>
          一覧へ戻る
        </Button>
      </div>

      <Card className="p-0 gap-0">
        <dl className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">資産コード</dt>

            <dd className="text-sm font-medium">{asset.code}</dd>
          </div>

          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">種別</dt>

            <dd className="text-sm font-medium">
              <AssetKindLabel kind={asset.kind} />
            </dd>
          </div>

          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">シリアル</dt>

            <dd className="text-sm font-medium">{asset.serial ?? "-"}</dd>
          </div>

          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">購入日</dt>

            <dd className="text-sm font-medium">{asset.purchased_on ?? "-"}</dd>
          </div>

          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">保有者</dt>

            <dd className="text-sm font-medium">
              {asset.holder_employee_id === null ? "-" : `#${asset.holder_employee_id}`}
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="p-0 gap-0">
        <div className="flex flex-col gap-4 p-6">
          <h2 className="text-lg font-semibold">貸与・返却</h2>

          {asset.status === "in_stock" ? <AssetLendForm code={asset.code} /> : null}

          {asset.status === "lent" ? <AssetReturnForm code={asset.code} /> : null}
        </div>
      </Card>
    </div>
  )
}
