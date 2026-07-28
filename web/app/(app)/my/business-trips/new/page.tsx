import { BusinessTripCreateForm } from "@/app/(app)/my/business-trips/_components/business-trip-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"

export const metadata = { title: "新規出張申請" }

/**
 * 出張申請の新規作成ページ。
 */
export default function NewBusinessTripPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="新規申請"
        description="出張先・期間・目的を記入して申請します。"
        actions={<BackButton href="/my/business-trips" label="一覧に戻る" />}
      />

      <Card className="max-w-xl">
        <CardContent>
          <BusinessTripCreateForm />
        </CardContent>
      </Card>
    </div>
  )
}
