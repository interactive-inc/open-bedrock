import { Suspense } from "react"
import { EmployeeDetail } from "@/app/(app)/employees/[code]/_components/employee-detail"
import { EmployeeEventHistory } from "@/app/(app)/employees/[code]/_components/employee-event-history"
import { EmployeeGradeHistory } from "@/app/(app)/employees/[code]/_components/employee-grade-history"
import { EmployeeSalaryRevisionHistory } from "@/app/(app)/employees/[code]/_components/employee-salary-revision-history"
import { EmployeeWorkStyleHistory } from "@/app/(app)/employees/[code]/_components/employee-work-style-history"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "従業員詳細" }

type Props = {
  params: Promise<{ code: string }>
}

// 従業員詳細画面。params.code で対象を取得し、詳細カードを Suspense 境界で描画する RSC。
export default async function EmployeeDetailPage(props: Props) {
  const params = await props.params

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="従業員詳細"
        actions={<BackButton href="/employees" label="一覧に戻る" />}
      />

      <Suspense fallback={<EmployeeDetailSkeleton />}>
        <EmployeeDetail code={params.code} />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <EmployeeGradeHistory code={params.code} />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <EmployeeSalaryRevisionHistory code={params.code} />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <EmployeeWorkStyleHistory code={params.code} />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <EmployeeEventHistory code={params.code} />
      </Suspense>
    </div>
  )
}

function EmployeeDetailSkeleton() {
  return <Skeleton className="h-64 w-full" />
}
