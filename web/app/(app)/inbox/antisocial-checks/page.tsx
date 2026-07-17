import { AntisocialCheckAdminTable } from "@/app/(app)/inbox/antisocial-checks/_components/antisocial-check-admin-table"
import { BackButton } from "@/components/back-button"
import { FetchError } from "@/components/fetch-error"
import { SubPageHeader } from "@/components/sub-page-header"
import { requirePermission } from "@/lib/auth/require-permission"
import { listAntisocialCheckAdmin } from "@/lib/api/list-antisocial-check-admin"

export const metadata = { title: "反社チェック判定" }

export default async function AntisocialCheckAdminPage() {
  await requirePermission("antisocial_check:manage")

  const checks = await listAntisocialCheckAdmin()

  return (
    <div className="flex flex-col gap-6">
      <SubPageHeader
        title="反社チェック判定"
        description="他の従業員から提出された申請を確認し、判定結果を記録します。"
        actions={<BackButton href="/my/antisocial-checks" label="自分の申請へ戻る" />}
      />

      {checks instanceof Error ? (
        <FetchError message="反社チェック受信箱の取得に失敗しました" />
      ) : (
        <AntisocialCheckAdminTable checks={checks} />
      )}
    </div>
  )
}
