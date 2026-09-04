import { FamilyCareLeaveCreateForm } from "@/app/(app)/my/family-care-leaves/_components/family-care-leave-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"

export const metadata = { title: "新規休業申出" }

/**
 * 産休・育休・介護休業の申出新規作成ページ。
 */
export default function NewFamilyCareLeavePage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="新規申出">
        <BackButton href="/my/family-care-leaves" label="一覧に戻る" />
      </PageHeader>

      <Card>
        <CardContent>
          <FamilyCareLeaveCreateForm />
        </CardContent>
      </Card>
    </div>
  )
}
