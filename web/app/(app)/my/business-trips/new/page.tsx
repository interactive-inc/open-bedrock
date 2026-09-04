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
    <div className="flex flex-col gap-8">
      <PageHeader title="新規申請">
        <BackButton href="/my/business-trips" label="一覧に戻る" />
      </PageHeader>

      <Card>
        <CardContent>
          <BusinessTripCreateForm />
        </CardContent>
      </Card>
    </div>
  )
}
