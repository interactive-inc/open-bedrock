import { LifeEventCreateForm } from "@/app/(app)/my/life-events/_components/life-event-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"

export const metadata = { title: "新規ライフイベント届出" }

/**
 * ライフイベント届出の新規作成ページ。
 */
export default function NewLifeEventPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="新規届出"
        description="イベントの種別と発生日を記入して届け出ます。"
        actions={<BackButton href="/my/life-events" label="一覧に戻る" />}
      />

      <Card className="max-w-xl">
        <CardContent>
          <LifeEventCreateForm />
        </CardContent>
      </Card>
    </div>
  )
}
