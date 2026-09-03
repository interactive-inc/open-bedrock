import Link from "next/link"
import { Suspense } from "react"
import { AttendanceClockForm } from "@/app/(app)/my/attendances/_components/attendance-clock-form"
import { AttendanceFilterForm } from "@/app/(app)/my/attendances/_components/attendance-filter-form"
import { AttendanceSummaryCard } from "@/app/(app)/my/attendances/_components/attendance-summary-card"
import { MyAttendanceList } from "@/app/(app)/my/attendances/_components/my-attendance-list"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getMe } from "@/lib/api/get-me"

export const metadata = { title: "勤怠" }

type Props = {
  searchParams: Promise<{ month?: string; from?: string; to?: string }>
}

/**
 * 勤怠（本人）画面。出勤 / 退勤の打刻、月次サマリ、本人の勤怠一覧を並べる RSC。
 * searchParams（month/from/to）を読むため動的レンダリングになる。
 */
export default async function AttendancePage(props: Props) {
  const [searchParams, currentUser] = await Promise.all([props.searchParams, getMe()])

  const canViewAll =
    currentUser instanceof Error ? false : currentUser.permissions.includes("attendance:read:all")

  const month = typeof searchParams.month === "string" ? searchParams.month : null

  const from = typeof searchParams.from === "string" ? searchParams.from : null

  const to = typeof searchParams.to === "string" ? searchParams.to : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="勤怠"
        actions={
          canViewAll ? (
            <Button
              variant="secondary"
              nativeButton={false}
              render={<Link href="/attendance/attendances" />}
            >
              勤怠一覧（管理者）
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AttendanceClockForm mode="clock-in" />

        <AttendanceClockForm mode="clock-out" />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">月次サマリ</h2>

        <Suspense key={month ?? ""} fallback={<Skeleton className="w-full" />}>
          <AttendanceSummaryCard month={month} />
        </Suspense>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">自分の勤怠</h2>

        <AttendanceFilterForm withEmployeeId={false} employeeId={null} from={from} to={to} />

        <Suspense key={`${from ?? ""}:${to ?? ""}`} fallback={<ListSkeleton rows={5} />}>
          <MyAttendanceList from={from} to={to} />
        </Suspense>
      </section>
    </div>
  )
}
