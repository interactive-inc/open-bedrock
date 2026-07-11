import { Suspense } from "react"
import { EmployeeDetail } from "@/app/(app)/employees/[code]/_components/employee-detail"
import { BackButton } from "@/components/back-button"
import { DetailSkeleton } from "@/components/detail-skeleton"
import { PageHeader } from "@/components/page-header"
import { getMe } from "@/lib/api/get-me"
import { canReadEmployees } from "@/lib/employee/can-read-employees"
import { notFound } from "next/navigation"

export const metadata = { title: "従業員詳細" }

type Props = {
  params: Promise<{ code: string }>
}

// 従業員詳細画面。params.code で対象を取得し、詳細カードを Suspense 境界で描画する RSC。
export default async function EmployeeDetailPage(props: Props) {
  const [params, currentUser] = await Promise.all([props.params, getMe()])

  if (
    currentUser instanceof Error ||
    (currentUser.code !== params.code && canReadEmployees(currentUser.permissions) === false)
  ) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="従業員詳細"
        actions={<BackButton href="/employees" label="一覧に戻る" />}
      />

      <Suspense fallback={<DetailSkeleton fields={5} />}>
        <EmployeeDetail
          code={params.code}
          permissions={currentUser.permissions}
          currentUserCode={currentUser.code}
        />
      </Suspense>
    </div>
  )
}
