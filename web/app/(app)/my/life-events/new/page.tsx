import { LifeEventCreateForm } from "@/app/(app)/my/life-events/_components/life-event-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { getMe } from "@/lib/api/get-me"

export const metadata = { title: "新規ライフイベント届出" }

/**
 * ライフイベント届出の新規作成ページ。転居の電話番号欄は設定済みの本人の電話番号を初期値にする。
 */
export default async function NewLifeEventPage() {
  const me = await getMe()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="新規届出"
        actions={<BackButton href="/my/life-events" label="一覧に戻る" />}
      />

      <Card>
        <CardContent>
          <LifeEventCreateForm phone={me.phone} />
        </CardContent>
      </Card>
    </div>
  )
}
