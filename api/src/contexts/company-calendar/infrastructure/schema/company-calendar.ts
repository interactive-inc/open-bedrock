import type { CalendarDayKind } from "@/lib/schemas"
import type { InferSelectModel } from "drizzle-orm"
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/** 会社カレンダー（会社休日と振替出勤日の記録）。通常営業日は行を持たない。判定・計算は持たず記録のみ。 */
export const companyCalendarDays = sqliteTable(
  "company_calendar_days",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    calendarDate: text("calendar_date").notNull(),
    kind: text("kind").notNull().$type<CalendarDayKind>(),
    name: text("name"),
    createdAt: text("created_at").notNull(),
  },
  // 同一日の重複登録を DB レベルで防ぐ（1 日 1 行）。
  (table) => [uniqueIndex("uq_company_calendar_days_date").on(table.calendarDate)],
)

export type CompanyCalendarDayRow = InferSelectModel<typeof companyCalendarDays>
