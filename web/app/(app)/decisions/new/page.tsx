import { notFound } from "next/navigation"
import { DecisionNewForm } from "@/app/(app)/decisions/_components/decision-new-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { getMe } from "@/lib/api/get-me"
import { canManageDecisions } from "@/lib/decision/can-manage-decisions"

export const metadata = { title: "意思決定記録の作成" }

/**
 * 意思決定記録の新規作成ページ（decision:manage のみ）。
 */
export default async function NewDecisionPage() {
  const me = await getMe()

  if (me instanceof Error || !canManageDecisions(me.permissions)) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="意思決定記録を作成"
        description="タイトル・決定日・背景・決定内容は必須です。"
        actions={<BackButton href="/decisions" label="一覧に戻る" />}
      />

      <Card className="max-w-3xl">
        <CardContent>
          <DecisionNewForm />
        </CardContent>
      </Card>
    </div>
  )
}
