import { DelegationManager } from "@/app/(app)/applications/delegations/_components/delegation-manager"
import { BackButton } from "@/components/back-button"
import { FetchError } from "@/components/fetch-error"
import { PageHeader } from "@/components/page-header"
import { getApprovalDelegations } from "@/lib/api/approval-delegations"

export const metadata = { title: "代理承認" }

export default async function ApprovalDelegationsPage() {
  const result = await getApprovalDelegations()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="代理承認"
        description="休暇・出張などの期間に、自分の承認権限を別の従業員へ委任します。"
        actions={<BackButton href="/applications" label="申請へ戻る" />}
      />
      {result instanceof Error ? (
        <FetchError message="代理承認設定の取得に失敗しました" />
      ) : (
        <DelegationManager delegations={result.data} />
      )}
    </div>
  )
}
