import { AssetLendForm } from "@/app/(app)/assets/_components/asset-lend-form"
import { AssetReturnForm } from "@/app/(app)/assets/_components/asset-return-form"
import { AssetKindLabel } from "@/components/asset-kind-label"
import { AssetStatusBadge } from "@/components/asset-status-badge"
import { BackButton } from "@/components/back-button"
import { DetailField } from "@/components/detail-field"
import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { getAssetByCode } from "@/lib/api/get-asset-by-code"
import { getEmployeeList } from "@/lib/api/get-employee-list"
import { handleDetailError } from "@/lib/api/handle-detail-error"

export const metadata = { title: "備品詳細" }

type Props = {
  params: Promise<{ code: string }>
}

// 物品詳細画面。RSC で 1 件取得し、属性と貸与/返却の操作を表示する。
export default async function AssetDetailPage(props: Props) {
  const params = await props.params

  const asset = await getAssetByCode(params.code)

  if (asset instanceof Error) {
    handleDetailError(asset)
  }

  const employeeResult = await getEmployeeList({ q: null, dept: null, status: "active" })

  const employees =
    employeeResult instanceof Error
      ? []
      : employeeResult.items.map((e) => ({ code: e.code, name: e.name }))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={asset.name} actions={<BackButton href="/assets" label="一覧に戻る" />} />

      <AssetStatusBadge status={asset.status} />

      <Card className="p-0 gap-0">
        <dl className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
          <DetailField label="資産コード">{asset.code}</DetailField>

          <DetailField label="種別">
            <AssetKindLabel kind={asset.kind} />
          </DetailField>

          <DetailField label="シリアル">{asset.serial ?? "-"}</DetailField>

          <DetailField label="購入日">{asset.purchased_on ?? "-"}</DetailField>

          <DetailField label="保有者">
            {asset.holder_employee_id === null ? "-" : `#${asset.holder_employee_id}`}
          </DetailField>
        </dl>
      </Card>

      <Card className="p-0 gap-0">
        <div className="flex flex-col gap-4 p-6">
          <h2 className="text-lg font-semibold">貸与・返却</h2>

          {asset.status === "in_stock" ? (
            <AssetLendForm code={asset.code} employees={employees} />
          ) : null}

          {asset.status === "lent" ? <AssetReturnForm code={asset.code} /> : null}
        </div>
      </Card>
    </div>
  )
}
