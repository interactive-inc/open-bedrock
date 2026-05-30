import { Suspense } from "react"
import { GoalFilterForm } from "@/app/(app)/goals/goal-filter-form"
import { GoalCreateForm } from "@/app/(app)/goals/goal-create-form"
import { GoalList } from "@/app/(app)/goals/goal-list"
import { Skeleton } from "@/components/ui/skeleton"

type Props = {
  searchParams: Promise<{ period?: string; employee_id?: string }>
}

// 目標一覧画面。period/employee で絞り込みつつ一覧と作成フォームを並べる RSC。
// searchParams を読むため動的レンダリングになる。
export default async function GoalsPage(props: Props) {
  const searchParams = await props.searchParams

  const period = typeof searchParams.period === "string" ? searchParams.period : null

  const employeeId = typeof searchParams.employee_id === "string" ? searchParams.employee_id : null

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">目標</h1>

      <GoalFilterForm period={period} employeeId={employeeId} />

      <GoalCreateForm defaultPeriod={period} />

      <Suspense key={`${period ?? ""}:${employeeId ?? ""}`} fallback={<GoalListSkeleton />}>
        <GoalList period={period} employeeId={employeeId} />
      </Suspense>
    </div>
  )
}

function GoalListSkeleton() {
  const placeholders = [0, 1, 2, 3, 4]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}
