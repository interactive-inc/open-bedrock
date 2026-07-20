import type { CalendarDayKind } from "@/lib/api/types/calendar-types"

/** 会社カレンダーの日種別を表示用ラベルへ変換する純粋関数。 */
export function toCalendarDayKindLabel(kind: CalendarDayKind): string {
  if (kind === "holiday") {
    return "会社休日"
  }

  return "振替出勤日"
}
