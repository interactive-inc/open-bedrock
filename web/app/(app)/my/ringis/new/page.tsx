import { RingiCreateForm } from "@/app/(app)/my/ringis/_components/ringi-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"

export const metadata = { title: "稟議の新規起案" }

/**
 * 稟議の新規起案。フォーム単機能のページとして、一覧から独立させる。
 */
export default function NewRingiPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="稟議を起案">
        <BackButton href="/my/ringis" label="一覧に戻る" />
      </PageHeader>

      <Card>
        <CardContent>
          <RingiCreateForm />
        </CardContent>
      </Card>
    </div>
  )
}
