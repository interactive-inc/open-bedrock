import { CalendarDeleteButton } from "@/app/(app)/company-calendar/calendars/_components/calendar-delete-button"
import { toCalendarDayKindLabel } from "@/app/(app)/company-calendar/calendars/_lib/calendar-day-kind-label"
import { EmptyState } from "@/components/empty-state"
import { FetchError } from "@/components/fetch-error"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getCalendar } from "@/lib/api/get-calendar"

type Props = {
  year: string | null
  canManage: boolean
}

/**
 * 指定年の会社カレンダー（会社休日・振替出勤日）一覧をサーバ側 fetch して描画する非同期 RSC。
 * canManage が true のときのみ削除ボタンの列を出す。
 */
export async function CalendarList(props: Props) {
  const days = await getCalendar(props.year)

  if (days instanceof Error) {
    return <FetchError message="会社カレンダーの取得に失敗しました" />
  }

  if (days.length === 0) {
    return <EmptyState title="登録された会社休日・振替出勤日がありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="会社カレンダー">
        <TableHeader>
          <TableRow>
            <TableHead>日付</TableHead>

            <TableHead>種別</TableHead>

            <TableHead>名称</TableHead>

            {props.canManage ? <TableHead className="text-right">操作</TableHead> : null}
          </TableRow>
        </TableHeader>

        <TableBody>
          {days.map((day) => (
            <TableRow key={day.id}>
              <TableCell className="font-medium">{day.calendar_date}</TableCell>

              <TableCell>
                <Badge variant={day.kind === "holiday" ? "secondary" : "outline"}>
                  {toCalendarDayKindLabel(day.kind)}
                </Badge>
              </TableCell>

              <TableCell className="text-muted-foreground">{day.name ?? "-"}</TableCell>

              {props.canManage ? (
                <TableCell className="text-right">
                  <div className="flex justify-end">
                    <CalendarDeleteButton id={day.id} />
                  </div>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
