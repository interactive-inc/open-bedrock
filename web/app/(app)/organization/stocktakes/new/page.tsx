import { StocktakeStartForm } from "@/app/(app)/organization/stocktakes/_components/stocktake-start-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { requirePermission } from "@/lib/auth/require-permission"

export const metadata = { title: "棚卸しを開始" }

/** 棚卸し開始画面。フォームは Client Component に切り出し、Server Action で POST /stocktakes する。 */
export default async function StocktakeNewPage() {
  await requirePermission("asset:manage")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="棚卸しを開始"
        description="対象日を指定して棚卸しセッションを開始します。開始時に廃棄済みでない全資産が対象になります。"
        actions={<BackButton href="/organization/stocktakes" label="一覧に戻る" />}
      />

      <Card className="max-w-xl p-0 gap-0">
        <div className="p-6">
          <StocktakeStartForm />
        </div>
      </Card>
    </div>
  )
}
