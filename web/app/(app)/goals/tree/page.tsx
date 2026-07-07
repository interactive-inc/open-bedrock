import Link from "next/link"
import { Suspense } from "react"
import { GoalTreeView } from "@/app/(app)/goals/tree/_components/goal-tree-view"
import { StructuralGoalCreateForm } from "@/app/(app)/goals/tree/_components/structural-goal-create-form"
import { FetchError } from "@/components/fetch-error"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { getGoalTree } from "@/lib/api/get-goal-tree"
import { getMe } from "@/lib/api/get-me"
import { canWriteCompanyGoal } from "@/lib/goal/can-write-company-goal"
import { canWriteDepartmentGoal } from "@/lib/goal/can-write-department-goal"

export const metadata = { title: "目標ツリー" }

type Props = {
  searchParams: Promise<{ period?: string }>
}

// 目標ツリー画面。全社→部門→個人をインデントで表示する。
// 全社・部門目標の作成フォームは権限を持つユーザーにのみ出す。
export default async function GoalTreePage(props: Props) {
  const searchParams = await props.searchParams

  const period = typeof searchParams.period === "string" ? searchParams.period : null

  const me = await getMe()

  const canCreateCompany = me instanceof Error ? false : canWriteCompanyGoal(me.permissions)

  const canCreateDepartment = me instanceof Error ? false : canWriteDepartmentGoal(me.permissions)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="目標ツリー"
        description="全社から部門・個人へと連なる目標を階層で確認します。"
        breadcrumbs={[{ label: "目標", href: "/goals" }, { label: "目標ツリー" }]}
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/goals" />}>
            目標一覧
          </Button>
        }
      />

      {canCreateCompany || canCreateDepartment ? (
        <StructuralGoalCreateForm
          canCreateCompany={canCreateCompany}
          canCreateDepartment={canCreateDepartment}
          defaultPeriod={period}
        />
      ) : null}

      <Suspense key={period ?? ""} fallback={<ListSkeleton rows={5} />}>
        <GoalTreeSection period={period} />
      </Suspense>
    </div>
  )
}

async function GoalTreeSection(props: { period: string | null }) {
  const roots = await getGoalTree(props.period)

  if (roots instanceof Error) {
    return <FetchError message="目標ツリーの取得に失敗しました" />
  }

  return <GoalTreeView roots={roots} />
}
