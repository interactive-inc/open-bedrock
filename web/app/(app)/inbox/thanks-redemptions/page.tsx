import { RedemptionInboxTable } from "@/app/(app)/inbox/thanks-redemptions/_components/redemption-inbox-table"
import { BackButton } from "@/components/back-button"
import { FetchError } from "@/components/fetch-error"
import { SubPageHeader } from "@/components/sub-page-header"
import { getThanksRedemptionInbox } from "@/lib/api/get-thanks-redemption-inbox"
import { requirePermission } from "@/lib/auth/require-permission"

export const metadata = { title: "景品交換承認" }

export default async function ThanksRedemptionInboxPage() {
  await requirePermission("thanks_redemption:approve")

  const redemptions = await getThanksRedemptionInbox()

  return (
    <div className="flex flex-col gap-8">
      <SubPageHeader
        title="サンクス交換の承認"
        description="自分以外から提出された交換申請を承認または却下します。"
        actions={<BackButton href="/thanks/thanks" label="感謝へ戻る" />}
      />

      {redemptions instanceof Error ? (
        <FetchError message="交換申請の承認受信箱を取得できませんでした" />
      ) : (
        <RedemptionInboxTable redemptions={redemptions} />
      )}
    </div>
  )
}
