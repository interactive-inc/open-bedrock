import { PartnerCreateForm } from "@/app/(app)/partner/partners/_components/partner-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"

export const metadata = { title: "取引先登録" }

/** 取引先登録画面。フォームは Client Component に切り出し、Server Action で POST /partners する。 */
export default function PartnerNewPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="取引先を登録">
        <BackButton href="/partner/partners" label="一覧に戻る" />
      </PageHeader>

      <Card className="gap-0">
        <div className="p-8">
          <PartnerCreateForm />
        </div>
      </Card>
    </div>
  )
}
