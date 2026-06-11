import Link from "next/link"
import { Suspense } from "react"
import { AttendanceAdminList } from "@/app/(app)/attendance/_components/attendance-admin-list"
import { AttendanceFilterForm } from "@/app/(app)/attendance/_components/attendance-filter-form"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "勤怠（全体）" }

type Props = {
  searchParams: Promise<{ employee_id?: string; from?: string; to?: string }>
}

// 勤怠一覧（管理者）画面。employee_id / from / to で全体の勤怠を絞り込んで表示する RSC。
// 権限がない場合は子の RSC 内でエラーメッセージにフォールバックする。
export default async function AttendanceAllPage(props: Props) {
  const searchParams = await props.searchParams

  const employeeId = typeof searchParams.employee_id === "string" ? searchParams.employee_id : null

  const from = typeof searchParams.from === "string" ? searchParams.from : null

  const to = typeof searchParams.to === "string" ? searchParams.to : null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">勤怠一覧（管理者）</h1>

        <Button variant="outline" render={<Link href="/attendance" />}>
          自分の勤怠へ
        </Button>
      </div>

      <AttendanceFilterForm withEmployeeId={true} employeeId={employeeId} from={from} to={to} />

      <Suspense
        key={`${employeeId ?? ""}:${from ?? ""}:${to ?? ""}`}
        fallback={<AttendanceListSkeleton />}
      >
        <AttendanceAdminList employeeId={employeeId} from={from} to={to} />
      </Suspense>
    </div>
  )
}

function AttendanceListSkeleton() {
  const placeholders = [0, 1, 2, 3, 4]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}
