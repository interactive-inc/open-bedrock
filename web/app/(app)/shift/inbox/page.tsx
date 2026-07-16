import { ShiftSwapInboxTable } from "@/app/(app)/shift/inbox/_components/shift-swap-inbox-table"
import { BackButton } from "@/components/back-button"
import { FetchError } from "@/components/fetch-error"
import { PageHeader } from "@/components/page-header"
import { getShiftSwapInbox } from "@/lib/api/get-shift-swap-inbox"
import { requirePermission } from "@/lib/auth/require-permission"

export const metadata = { title: "シフト交代承認" }

export default async function ShiftSwapInboxPage() {
  await requirePermission("shift_swap:approve")

  const requests = await getShiftSwapInbox()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="シフト交代承認"
        description="当事者ではない申請の内容を確認し、シフト割当を入れ替えます。"
        actions={<BackButton href="/shift" label="シフトへ戻る" />}
      />

      {requests instanceof Error ? (
        <FetchError message="シフト交代の承認受信箱を取得できませんでした" />
      ) : (
        <ShiftSwapInboxTable requests={requests} />
      )}
    </div>
  )
}
