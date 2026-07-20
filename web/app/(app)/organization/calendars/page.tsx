import { Suspense } from "react"
import { CalendarAddForm } from "@/app/(app)/organization/calendars/_components/calendar-add-form"
import { CalendarList } from "@/app/(app)/organization/calendars/_components/calendar-list"
import { CalendarYearForm } from "@/app/(app)/organization/calendars/_components/calendar-year-form"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { getMe } from "@/lib/api/get-me"
import { canManageCalendar } from "@/lib/calendar/can-manage-calendar"

export const metadata = { title: "会社カレンダー" }

type Props = {
  searchParams: Promise<{ year?: string }>
}

/** 会社カレンダー画面。年ごとの会社休日・振替出勤日を一覧し、calendar:manage 保持者には追加・削除を出す RSC。 */
export default async function CalendarPage(props: Props) {
  const searchParams = await props.searchParams

  const year = typeof searchParams.year === "string" ? searchParams.year : null

  const currentUser = await getMe()

  const canManage =
    currentUser instanceof Error ? false : canManageCalendar(currentUser.permissions)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="会社カレンダー"
        description="会社休日と振替出勤日の記録です。通常営業日は登録しません。"
      />

      <CalendarYearForm year={year} />

      {canManage ? <CalendarAddForm /> : null}

      <Suspense key={year ?? ""} fallback={<ListSkeleton rows={5} />}>
        <CalendarList year={year} canManage={canManage} />
      </Suspense>
    </div>
  )
}
