import { GoalCreateForm } from "@/app/(app)/organization/goals/_components/goal-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"

export const metadata = { title: "目標を作成" }

type Props = {
  searchParams: Promise<{ period?: string }>
}

/**
 * 目標の新規作成。フォーム単機能のページとして、一覧から独立させる。
 */
export default async function NewGoalPage(props: Props) {
  const searchParams = await props.searchParams

  const period = typeof searchParams.period === "string" ? searchParams.period : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="新規目標"
        description="期間と内容を入力して目標を登録します。"
        actions={<BackButton href="/organization/goals" label="一覧に戻る" />}
      />

      <Card className="max-w-xl">
        <CardContent>
          <GoalCreateForm defaultPeriod={period} />
        </CardContent>
      </Card>
    </div>
  )
}
