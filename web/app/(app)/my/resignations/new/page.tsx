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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="新規申請"
        actions={<BackButton href="/my/resignations" label="一覧に戻る" />}
      />

      <Card className="max-w-xl">
        <CardContent>
          <ResignationCreateForm />
        </CardContent>
      </Card>
    </div>
  )
}
