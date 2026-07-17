import { ThanksCreateForm } from "@/app/(app)/organization/thanks/_components/thanks-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"

export const metadata = { title: "感謝を送る" }

/**
 * 感謝の送付。フォーム単機能のページとして、タイムラインから独立させる。
 */
export default function SendThanksPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="感謝を送る"
        description="送り先と感謝のメッセージを入力します。任意でポイントを添えられます。"
        actions={<BackButton href="/organization/thanks" label="感謝に戻る" />}
      />

      <Card className="max-w-xl">
        <CardContent>
          <ThanksCreateForm />
        </CardContent>
      </Card>
    </div>
  )
}
