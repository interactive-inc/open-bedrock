import { AntisocialCheckCreateForm } from "@/app/(app)/my/antisocial-checks/_components/antisocial-check-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"

export const metadata = { title: "新規反社チェック申請" }

/**
 * 反社チェック申請の新規作成ページ。
 */
export default function NewAntisocialCheckPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="新規申請"
        description="対象者と確認内容を記入して申請します。"
        actions={<BackButton href="/my/antisocial-checks" label="一覧に戻る" />}
      />

      <Card className="max-w-xl">
        <CardContent>
          <AntisocialCheckCreateForm />
        </CardContent>
      </Card>
    </div>
  )
}
