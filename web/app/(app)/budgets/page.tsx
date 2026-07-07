import { Plus } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { BudgetList } from "@/app/(app)/budgets/_components/budget-list"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { getMe } from "@/lib/api/get-me"
import { canManageBudgets } from "@/lib/budget/can-manage-budgets"
import { canViewAllBudgets } from "@/lib/budget/can-view-all-budgets"

export const metadata = { title: "予算枠" }

type Props = {
  searchParams: Promise<{ page?: string }>
}

// /budgets 予算枠の一覧。budget:read:all が無ければ notFound。残額は「予算 − 消化合計」の単純減算。
export default async function BudgetsPage(props: Props) {
  const me = await getMe()

  if (me instanceof Error || canViewAllBudgets(me.permissions) === false) {
    notFound()
  }

  const params = await props.searchParams

  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1)

  const offset = (page - 1) * 20

  const canManage = canManageBudgets(me.permissions)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="予算枠"
        description="会計年度・部署ごとの予算を記録します。消化は手動記録で、会計計算や支払処理は行いません。"
        actions={
          canManage ? (
            <Button nativeButton={false} render={<Link href="/budgets/new" />}>
              <Plus />
              予算枠を作成
            </Button>
          ) : null
        }
      />

      <Suspense key={String(page)} fallback={<ListSkeleton rows={5} rowClassName="h-12 w-full" />}>
        <BudgetList offset={offset} canManage={canManage} />
      </Suspense>
    </div>
  )
}
