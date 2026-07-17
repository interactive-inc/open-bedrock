import { Suspense } from "react"
import { PartnerContractsSection } from "@/app/(app)/organization/partners/_components/partner-contracts-section"
import { PartnerStatusBadge } from "@/app/(app)/organization/partners/_components/partner-status-badge"
import { partnerCategoryLabel } from "@/app/(app)/organization/partners/_lib/partner-category-label"
import { BackButton } from "@/components/back-button"
import { DetailField } from "@/components/detail-field"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { getMe } from "@/lib/api/get-me"
import { getPartnerByCode } from "@/lib/api/get-partner-by-code"
import { handleDetailError } from "@/lib/api/handle-detail-error"
import { canManageContracts } from "@/lib/contract/can-manage-contracts"
import { canViewAllContracts } from "@/lib/contract/can-view-all-contracts"

export const metadata = { title: "取引先詳細" }

type Props = {
  params: Promise<{ partner: string }>
}

// 取引先詳細画面。RSC で 1 件取得し、属性と契約記録セクションを表示する。
// 契約記録は contract:read:all を持つ場合のみ表示する（api も 403 で守る）。
export default async function PartnerDetailPage(props: Props) {
  const params = await props.params

  const partner = await getPartnerByCode(params.partner)

  if (partner instanceof Error) {
    handleDetailError(partner)
  }

  const currentUser = await getMe()

  const permissions = currentUser instanceof Error ? [] : currentUser.permissions

  const canViewContracts = canViewAllContracts(permissions)

  const canManage = canManageContracts(permissions)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={partner.name}
        actions={<BackButton href="/organization/partners" label="一覧に戻る" />}
      />

      <PartnerStatusBadge status={partner.status} />

      <Card className="p-0 gap-0">
        <dl className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
          <DetailField label="取引先コード">{partner.code}</DetailField>

          <DetailField label="分類">{partnerCategoryLabel(partner.category)}</DetailField>

          <DetailField label="法人番号">{partner.corporate_number ?? "-"}</DetailField>

          <DetailField label="登録日">{partner.created_at}</DetailField>

          <DetailField label="備考">{partner.note ?? "-"}</DetailField>
        </dl>
      </Card>

      {canViewContracts ? (
        <Suspense fallback={<ListSkeleton rows={3} />}>
          <PartnerContractsSection
            partnerId={partner.id}
            partnerCode={partner.code}
            canManageContracts={canManage}
          />
        </Suspense>
      ) : null}
    </div>
  )
}
