import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import type { CalendarDayKind } from "@/contexts/company-calendar/domain/definitions/calendar-day-kind.definition"
import { sql, type InferSelectModel } from "drizzle-orm"
import { check, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/** 会社カレンダー（会社休日と振替出勤日の記録）。通常営業日は行を持たない。判定・計算は持たず記録のみ。 */
export const companyCalendarDays = sqliteTable(
  "company_calendar_days",
  {
    id: text("id").primaryKey().notNull(),
    calendarDate: text("calendar_date").notNull(),
    kind: text("kind").notNull().$type<CalendarDayKind>(),
    name: text("name"),
    createdAt: text("created_at").notNull(),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の証跡を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
  },
  // 同一日の重複登録を DB レベルで防ぐ（1 日 1 行）。
  (table) => [
    check("company_calendar_days_id_uuid", sql.raw(uuidCheckPredicate("id"))),
    uniqueIndex("uq_company_calendar_days_date").on(table.calendarDate),
  ],
)

export type CompanyCalendarDayRow = InferSelectModel<typeof companyCalendarDays>
