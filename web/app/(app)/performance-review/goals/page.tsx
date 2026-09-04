import { Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { GoalFilterForm } from "@/app/(app)/performance-review/goals/_components/goal-filter-form"
import { GoalList } from "@/app/(app)/performance-review/goals/_components/goal-list"
import { toGoalPeriodOptions } from "@/app/(app)/performance-review/goals/_lib/to-goal-period-options"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { getMe } from "@/lib/api/get-me"
import { getReviewPeriods } from "@/lib/api/get-review-periods"

export const metadata = { title: "全社の目標" }

type Props = {
  searchParams: Promise<{ period?: string; employee_id?: string }>
}

/**
 * 目標一覧画面。period/employee で絞り込んで一覧を表示する R 専用画面。
 * 作成は /goals/new に分離。
 */
export default async function GoalsPage(props: Props) {
  const [searchParams, currentUser, periods] = await Promise.all([
    props.searchParams,
    getMe(),
    getReviewPeriods(),
  ])

  const canViewOthers =
    currentUser instanceof Error ? false : currentUser.permissions.includes("goal:read:all")

  const period = typeof searchParams.period === "string" ? searchParams.period : null

  const employeeId =
    canViewOthers && typeof searchParams.employee_id === "string" ? searchParams.employee_id : null

  const newHref =
    period === null
      ? "/performance-review/goals/new"
      : `/performance-review/goals/new?period=${encodeURIComponent(period)}`

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="全社の目標">
        <div className="flex gap-2">
          <Button
            variant="secondary"
            nativeButton={false}
            render={<Link href="/performance-review/goals/tree" />}
          >
            目標ツリー
          </Button>

          <Button nativeButton={false} render={<Link href={newHref} />}>
            <Plus />
            新規目標
          </Button>
        </div>
      </PageHeader>

      <GoalFilterForm
        period={period}
        employeeId={employeeId}
        canFilterEmployee={canViewOthers}
        periodOptions={toGoalPeriodOptions(periods instanceof Error ? [] : periods, period)}
      />

      <Suspense key={`${period ?? ""}:${employeeId ?? ""}`} fallback={<ListSkeleton rows={5} />}>
        <GoalList period={period} employeeId={employeeId} />
      </Suspense>
    </div>
  )
}
