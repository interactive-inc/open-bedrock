import { ResignationCreateForm } from "@/app/(app)/my/resignations/_components/resignation-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"

export const metadata = { title: "新規退職申請" }

/**
 * 退職申請の新規作成ページ。
 */
export default function NewResignationPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="新規申請">
        <BackButton href="/my/resignations" label="一覧に戻る" />
      </PageHeader>

      <Card>
        <CardContent>
          <ResignationCreateForm />
        </CardContent>
      </Card>
    </div>
  )
}
