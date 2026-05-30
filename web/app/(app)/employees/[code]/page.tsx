import Link from "next/link"
import { Suspense } from "react"
import { EmployeeDetail } from "@/app/(app)/employees/[code]/employee-detail"
import { Skeleton } from "@/components/ui/skeleton"

type Props = {
  params: Promise<{ code: string }>
}

// 従業員詳細画面。params.code で対象を取得し、詳細カードを Suspense 境界で描画する RSC。
export default async function EmployeeDetailPage(props: Props) {
  const params = await props.params

  return (
    <div className="flex flex-col gap-6">
      <Link href="/employees" className="text-sm text-muted-foreground hover:text-foreground">
        ← 従業員一覧へ戻る
      </Link>

      <Suspense fallback={<EmployeeDetailSkeleton />}>
        <EmployeeDetail code={params.code} />
      </Suspense>
    </div>
  )
}

function EmployeeDetailSkeleton() {
  return <Skeleton className="h-64 w-full" />
}
