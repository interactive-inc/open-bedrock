import { notFound } from "next/navigation"
import { Suspense } from "react"
import { DepartmentHeadcountTable } from "@/app/(app)/organization/dashboards/management/_components/department-headcount-table"
import { GoalDoneRateTable } from "@/app/(app)/organization/dashboards/management/_components/goal-done-rate-table"
import { ManagementMetricCards } from "@/app/(app)/organization/dashboards/management/_components/management-metric-cards"
import { FetchError } from "@/components/fetch-error"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { canViewManagementDashboard } from "@/lib/dashboard/can-view-management-dashboard"
import { getManagementDashboard } from "@/lib/api/get-management-dashboard"
import { getMe } from "@/lib/api/get-me"

export const metadata = { title: "経営ダッシュボード" }

// 経営ダッシュボード。management_dashboard:view が無ければ notFound。
// 在籍・入退社・勤怠・休暇・経費・評価・目標・申請の横断集計を表示する。
export default async function ManagementDashboardPage() {
  const me = await getMe()

  if (me instanceof Error || canViewManagementDashboard(me.permissions) === false) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="経営ダッシュボード"
        description="在籍・入退社・勤怠・休暇・経費・評価・目標・申請の横断集計を確認します。"
      />

      <Suspense fallback={<ListSkeleton rows={4} />}>
        <ManagementDashboardSection />
      </Suspense>
    </div>
  )
}

async function ManagementDashboardSection() {
  const summary = await getManagementDashboard()

  if (summary instanceof Error) {
    return <FetchError message="経営ダッシュボードの取得に失敗しました" />
  }

  return (
    <div className="flex flex-col gap-8">
      <ManagementMetricCards summary={summary} />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">部署別の在籍者数</h2>

        <DepartmentHeadcountTable rows={summary.department_headcounts} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">期間別の目標達成率</h2>

        <GoalDoneRateTable rows={summary.goal_done_rates} />
      </section>
    </div>
  )
}
