import { AssetDisposeForm } from "@/app/(app)/asset/assets/_components/asset-dispose-form"
import { AssetLendForm } from "@/app/(app)/asset/assets/_components/asset-lend-form"
import { AssetReturnForm } from "@/app/(app)/asset/assets/_components/asset-return-form"
import { AssetKindLabel } from "@/components/asset-kind-label"
import { AssetStatusBadge } from "@/components/asset-status-badge"
import { BackButton } from "@/components/back-button"
import { DetailField } from "@/components/detail-field"
import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { getAssetByCode } from "@/lib/api/get-asset-by-code"
import { getEmployeeDirectory } from "@/lib/api/get-employee-directory"
import { handleDetailError } from "@/lib/api/handle-detail-error"
import { getMe } from "@/lib/api/get-me"
import { canManageAssets } from "@/lib/asset/can-manage-assets"

export const metadata = { title: "備品詳細" }

type Props = {
  params: Promise<{ asset: string }>
}

/** 物品詳細画面。RSC で 1 件取得し、属性と貸与/返却の操作を表示する。 */
export default async function AssetDetailPage(props: Props) {
  const params = await props.params

  const [asset, currentUser] = await Promise.all([getAssetByCode(params.asset), getMe()])

  if (asset instanceof Error) {
    handleDetailError(asset)
  }

  const canManage = currentUser instanceof Error ? false : canManageAssets(currentUser.permissions)

  const employeeResult = canManage ? await getEmployeeDirectory() : null

  const employees =
    employeeResult === null || employeeResult instanceof Error
      ? []
      : employeeResult.items.flatMap((e) =>
          e.code === null ? [] : [{ code: e.code, name: e.name }],
        )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={asset.name}
        actions={<BackButton href="/asset/assets" label="一覧に戻る" />}
      />

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

          {asset.status === "disposed" ? (
            <>
              <DetailField label="廃棄日">{asset.disposed_on ?? "-"}</DetailField>

              <DetailField label="廃棄理由">{asset.disposal_reason ?? "-"}</DetailField>
            </>
          ) : null}
        </dl>
      </Card>

      {asset.status === "disposed" || canManage === false ? null : (
        <Card className="p-0 gap-0">
          <div className="flex flex-col gap-4 p-6">
            <h2 className="text-lg font-semibold">貸与・返却</h2>

            {asset.status === "in_stock" ? (
              <AssetLendForm code={asset.code} employees={employees} />
            ) : null}

            {asset.status === "lent" ? <AssetReturnForm code={asset.code} /> : null}
          </div>
        </Card>
      )}

      {asset.status === "in_stock" && canManage ? (
        <Card className="p-0 gap-0">
          <div className="flex flex-col gap-4 p-6">
            <h2 className="text-lg font-semibold">廃棄</h2>

            <p className="text-sm text-muted-foreground">
              廃棄すると在庫から外れ、貸与できなくなります。
            </p>

            <AssetDisposeForm code={asset.code} />
          </div>
        </Card>
      ) : null}
    </div>
  )
}
