import { AssetCreateForm } from "@/app/(app)/asset/assets/_components/asset-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { requirePermission } from "@/lib/auth/require-permission"

export const metadata = { title: "備品登録" }

/** 物品登録画面。フォームは Client Component に切り出し、Server Action で POST /assets する。 */
export default async function AssetNewPage() {
  await requirePermission("asset:manage")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="物品を登録"
        actions={<BackButton href="/asset/assets" label="一覧に戻る" />}
      />

      <Card className="max-w-xl p-0 gap-0">
        <div className="p-6">
          <AssetCreateForm />
        </div>
      </Card>
    </div>
  )
}
