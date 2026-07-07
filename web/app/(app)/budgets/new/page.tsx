import { notFound } from "next/navigation"
import { BudgetCreateForm } from "@/app/(app)/budgets/_components/budget-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { getMe } from "@/lib/api/get-me"
import { canManageBudgets } from "@/lib/budget/can-manage-budgets"

export const metadata = { title: "予算枠の作成" }

// 予算枠の作成画面。budget:manage が無ければ notFound。
export default async function BudgetNewPage() {
  const me = await getMe()

  if (me instanceof Error || canManageBudgets(me.permissions) === false) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="予算枠を作成"
        description="会計年度・部署ごとの予算枠を登録します。"
        actions={<BackButton href="/budgets" label="一覧に戻る" />}
      />

      <Card className="max-w-xl p-0 gap-0">
        <div className="p-6">
          <BudgetCreateForm />
        </div>
      </Card>
    </div>
  )
}
