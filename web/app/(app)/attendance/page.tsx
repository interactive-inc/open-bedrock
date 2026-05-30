import Link from "next/link"
import { Suspense } from "react"
import { AttendanceClockForm } from "@/app/(app)/attendance/attendance-clock-form"
import { AttendanceFilterForm } from "@/app/(app)/attendance/attendance-filter-form"
import { AttendanceSummaryCard } from "@/app/(app)/attendance/attendance-summary-card"
import { MyAttendanceList } from "@/app/(app)/attendance/my-attendance-list"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

type Props = {
  searchParams: Promise<{ month?: string; from?: string; to?: string }>
}

// 勤怠（本人）画面。出勤 / 退勤の打刻、月次サマリ、本人の勤怠一覧を並べる RSC。
// searchParams（month/from/to）を読むため動的レンダリングになる。
export default async function AttendancePage(props: Props) {
  const searchParams = await props.searchParams

  const month = typeof searchParams.month === "string" ? searchParams.month : null

  const from = typeof searchParams.from === "string" ? searchParams.from : null

  const to = typeof searchParams.to === "string" ? searchParams.to : null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">勤怠</h1>

        <Button variant="outline" render={<Link href="/attendance/all" />}>
          勤怠一覧（管理者）
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AttendanceClockForm mode="clock-in" />

        <AttendanceClockForm mode="clock-out" />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">月次サマリ</h2>

        <Suspense key={month ?? ""} fallback={<Skeleton className="h-24 w-full" />}>
          <AttendanceSummaryCard month={month} />
        </Suspense>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">自分の勤怠</h2>

        <AttendanceFilterForm withEmployeeId={false} employeeId={null} from={from} to={to} />

        <Suspense key={`${from ?? ""}:${to ?? ""}`} fallback={<AttendanceListSkeleton />}>
          <MyAttendanceList from={from} to={to} />
        </Suspense>
      </section>
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
