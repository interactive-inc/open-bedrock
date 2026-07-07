import { Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { GoalFilterForm } from "@/app/(app)/goals/_components/goal-filter-form"
import { GoalList } from "@/app/(app)/goals/_components/goal-list"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"

export const metadata = { title: "目標" }

type Props = {
  searchParams: Promise<{ period?: string; employee_id?: string }>
}

/**
 * 目標一覧画面。period/employee で絞り込んで一覧を表示する R 専用画面。
 * 作成は /goals/new に分離。
 */
export default async function GoalsPage(props: Props) {
  const searchParams = await props.searchParams

  const period = typeof searchParams.period === "string" ? searchParams.period : null

  const employeeId = typeof searchParams.employee_id === "string" ? searchParams.employee_id : null

  const newHref = period === null ? "/goals/new" : `/goals/new?period=${encodeURIComponent(period)}`

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="目標"
        description="期間と従業員で絞り込み、目標を確認します。"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" nativeButton={false} render={<Link href="/goals/tree" />}>
              目標ツリー
            </Button>

            <Button nativeButton={false} render={<Link href={newHref} />}>
              <Plus />
              新規目標
            </Button>
          </div>
        }
      />

      <GoalFilterForm period={period} employeeId={employeeId} />

      <Suspense key={`${period ?? ""}:${employeeId ?? ""}`} fallback={<ListSkeleton rows={5} />}>
        <GoalList period={period} employeeId={employeeId} />
      </Suspense>
    </div>
  )
}
